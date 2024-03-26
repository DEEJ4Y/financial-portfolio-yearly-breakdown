# Financial Portfolio Analysis

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >v16 with NPM

### Add trade data

Add your trade `.csv` files in the data folder in the root of the project.

#### For Zerodha users

CSV files should be in the following format

```csv
symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
```

#### For Groww users

1. Download the P&L Report Excel sheet from Groww.
2. Copy the trade table and paste it in another blank sheet.
3. Export the new sheet as a CSV file.

CSV files should be in the following format

```csv
Stock name,ISIN,Quantity,Buy date,Buy price,Buy value,Sell date,Sell price,Sell value,Realised P&L,Remark
```

### Install packages

Install the required packages. Run the following CLI command in the root folder of the project.

```sh
npm install
```

### Add Starting date for XIRR Calculation (Optional)

If you want to see your XIRR from a particular date, update the first line in `index.js` with your start date. By default it is `1 Apr 2023`.

If you want to disable this, comment out the first line by adding two forward slashes to the beginning. Uncomment the second line by removing the two forward slashes. Save the file and proceed.

## Run the project

```
node index.js
```

If it runs successfully, you should be able to see the follwing files in the data folder:

```
allTrades.json
exitedTrades.json
holdings.json
lifetime-profits-breakdown.json
lifetime-total-profit.txt
yearly-profits-breakdown.json
yearly-symbol-profits-breakdown.json
```

Your XIRR Breakdown for realized P&L will be logged in the terminal.
