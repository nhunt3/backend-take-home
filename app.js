const vorpal = require('vorpal')();
const prettyjson = require('prettyjson');
const cTable = require('console.table');
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://nhunt:RoomsToGo@nick-q9qpg.mongodb.net/test";
let dbo = null;
const options = {noColor: true};
const Log = require('./log');
const log = new Log();
// const fs = require('fs');
// const writeStream = fs.createWriteStream('log.txt');
// process.stdin.pipe(writeStream);

MongoClient.connect(uri, { useNewUrlParser: true }, function(err, client) {
    if(err) {
         console.log('Error occurred while connecting to MongoDB Atlas...\n',err);
    }
    // console.log('Connected...');
    dbo = client.db("roomsToGo");
    // client.close();
});

vorpal
    .command('ADD PRODUCT <productName> <sku>', 'Creates a product in the product catalog')
    .action(function(args, callback) {
        log.write(`ADD PRODUCT ${args.productName} ${args.sku}`);
        const newProduct = { productName: args.productName, sku: args.sku };
        dbo.collection("Products").insertOne(newProduct, function(err, res) {
          if (err) {
              console.error(err);
          }
          else {
            console.log("new product, " + args.productName + ", inserted");
          }
          callback();
        });
    });

vorpal
    .command('ADD WAREHOUSE <warehouseNumber> [stockLimit]', 'Creates a new warehouse where we can stock products')
    .action(function(args, callback) {
        const newWarehouse = { warehouseNumber: args.warehouseNumber, stockLimit: args.stockLimit, products: [] };
        dbo.collection("Warehouses").insertOne(newWarehouse, function(err, res) {
          if (err) {
              console.error(err);
          }
          else {
            console.log("new warehouse, " + args.warehouseNumber + ", inserted");
          }
          callback();
        });
    });

vorpal
    .command('STOCK <sku> <warehouseNumber> <qty>', 'Stocks "qty" amount of product with sku in specified warehouse')
    .action(async (args, callback) => {
        try {
            log.write(`STOCK ${args.sku} ${args.warehouseNumber} ${args.qty}`);
            const productsProjection = {projection:{_id: 0}};
            const productsFilter = {sku: args.sku};
            const products = await dbo.collection("Products").find(productsFilter, productsProjection).toArray();
            
            const warehousesProjection = {projection:{_id: 0}};
            const warehousesFilter = {warehouseNumber: args.warehouseNumber};
            const warehouses = await dbo.collection("Warehouses").find(warehousesFilter, warehousesProjection).toArray();
            
            // if sku is in product catalog and warehouse exists
            if (products.length === 1 && warehouses.length === 1) {
                const product = products[0];
                const warehouse = warehouses[0];
                const nameOfProductToStock = product.productName;
                const warehouseStockLimit = warehouse.stockLimit === null ? Number.MAX_SAFE_INTEGER : warehouse.stockLimit;
                const productToAdd = warehouse.products.filter(product => product.sku === args.sku);
                const currTotalQtyInWarehouse = warehouse.products.reduce((total, obj) => total + obj.qty, 0);
                
                // if sku is already in warehouse, then add to existing quantity
                if (productToAdd.length === 1) {
                    const remainingCapacityInWarehouse = warehouseStockLimit - currTotalQtyInWarehouse;
                    const newQty = Math.min(args.qty, remainingCapacityInWarehouse);
                    
                    const query = {
                        warehouseNumber: args.warehouseNumber,
                        'products.sku': args.sku
                    };
                    const newValues = { $inc: { 'products.$.qty': newQty } };
                    const res = await dbo.collection("Warehouses").updateOne(query, newValues);
                    console.log("Success! We added your quantity to the existing quantity in the warehouse for that sku!");
                    callback();
                }
                // if sku not in warehouse, then add it to warehouse
                else {
                    const query = {
                        warehouseNumber: args.warehouseNumber
                    };
                    const newValues = { $push: { 'products': {productName: nameOfProductToStock, sku: args.sku, qty: Math.min(args.qty, warehouseStockLimit)} } };
                    const res = await dbo.collection("Warehouses").updateOne(query, newValues);
                    console.log('Success! Product added to warehouse!');
                    callback();
                }
            }
            else {
                console.log("Make sure that:\n 1. This sku is in the product catalog\n 2. This warehouse number exists");
                callback();
            }
        }
        catch(err) {
            console.error(err);
            callback();
        }
    });

vorpal
    .command('UNSTOCK <sku> <warehouseNumber> <qty>', 'Unstocks "qty" amount of product with sku in specified warehouse')
    .action(async (args, callback) => {
        try {
            log.write(`UNSTOCK ${args.sku} ${args.warehouseNumber} ${args.qty}`);
            const warehousesProjection = {projection:{_id: 0}};
            const warehousesFilter = {warehouseNumber: args.warehouseNumber};
            const warehouses = await dbo.collection("Warehouses").find(warehousesFilter, warehousesProjection).toArray();

            if (warehouses.length === 1) {
                const productArr = warehouses[0].products.filter(product => product.sku === args.sku);
                if (productArr.length === 1) {
                    const existingQtyForSku = productArr[0].qty;
                    const remainingQty = existingQtyForSku - args.qty;
                    const newQty = remainingQty > 0 ? remainingQty : 0;
                    const query = {
                        warehouseNumber: args.warehouseNumber,
                        'products.sku': args.sku
                    };
                    const newValues = { $set: { 'products.$.qty': newQty } };
                    const res = await dbo.collection("Warehouses").updateOne(query, newValues);
                    console.log("Success! We added your quantity to the existing quantity in the warehouse for thast sku!");
                    callback();
                }
            }
            else {
                console.log('That warehouse number does not exist')
            }
        }
        catch(err) {
            console.error(err);
            callback();
        }
    });

vorpal
    .command('LIST PRODUCTS', 'List all products')
    .action(function(args, callback) {
        log.write(`LIST PRODUCTS`);
        const projection = {projection:{_id: 0}};
        dbo.collection("Products").find({}, projection).toArray(function(err, result) {
            if (err) {
                console.error(err);
            }
            else {
                console.table(result); 
            }
            callback();
        });
    });

vorpal
    .command('LIST WAREHOUSES', 'List all warehouses')
    .action(function(args, callback) {
        log.write(`LIST WAREHOUSES`);
        const projection = {projection:{_id: 0, warehouseNumber:1}};
        dbo.collection("Warehouses").find({}, projection).toArray(function(err, documents) {
            if (err) {
                console.error(err);
            }
            else {
                const warehouseNumbers = documents.map(w => w.warehouseNumber);
                console.log(prettyjson.render(warehouseNumbers, options));
            }
            callback();
        });
    });

vorpal
    .command('LIST WAREHOUSE <warehouseNumber>', 'List all info about the warehouse')
    .action(function(args, callback) {
        log.write(`LIST WAREHOUSE ${args.warehouseNumber}`);
        const projection = {projection:{_id: 0}};
        const filter = {warehouseNumber: args.warehouseNumber};
        dbo.collection("Warehouses").find(filter, projection).toArray(function(err, documents) {
            if (err) {
                console.error(err);
            }
            else {
                console.log(prettyjson.render(documents, options));
            }
            callback();
        });
    });

vorpal
    .delimiter('>')
    .show();