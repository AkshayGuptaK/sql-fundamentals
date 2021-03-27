import { getDb } from '../db/utils';
import { sql } from '../sql-string';

export const ALL_ORDERS_COLUMNS = [
  'id',
  'customerid',
  'employeeid',
  'shipcity',
  'shipaddress',
  'shipname',
  'shipvia',
  'shipregion',
  'shipcountry',
  'shippostalcode',
  'requireddate',
  'freight'
];
export const ORDER_COLUMNS = ['*'];

/**
 * @typedef OrderCollectionOptions
 * @property {number} page Page number (zero-indexed)
 * @property {number} perPage Results per page
 * @property {string} sort Property to sort by
 * @property {'asc'|'desc'} order Sort direction
 * @description Options that may be used to customize a query for a collection of CustomerOrder records
 */

/**
 * Defaults values to use when parts of OrderCollectionOptions are not provided
 * @type {Readonly<OrderCollectionOptions>}
 */
const DEFAULT_ORDER_COLLECTION_OPTIONS = Object.freeze(
  /** @type {OrderCollectionOptions}*/ ({
    order: 'asc',
    page: 1,
    perPage: 20,
    sort: 'id'
  })
);

const DEFAULT_CUSTOMER_ORDER_COLLECTION_OPTIONS = Object.freeze(
  /** @type {OrderCollectionOptions}*/ ({
    order: 'asc',
    sort: 'shippeddate'
  })
);

/**
 * Retrieve a collection of "all orders" from the database.
 * NOTE: This table has tens of thousands of records, so we'll probably have to apply
 *    some strategy for viewing only a part of the collection at any given time
 * @param {Partial<OrderCollectionOptions>} opts Options for customizing the query
 * @returns {Promise<Order[]>} the orders
 */
export async function getAllOrders(opts = {}, whereClause = '') {
  // Combine the options passed into the function with the defaults

  /** @type {OrderCollectionOptions} */
  let options = {
    ...DEFAULT_ORDER_COLLECTION_OPTIONS,
    ...opts
  };

  const db = await getDb();
  let sortClause = '';
  if (options.sort) {
    sortClause = sql`ORDER BY co.${options.sort} ${options.order.toUpperCase()}`;
  }
  const offset = (options.page - 1) * options.perPage;
  let paginationClause = sql`LIMIT ${options.perPage} OFFSET ${offset}`;
  return await db.all(sql`
    SELECT ${ALL_ORDERS_COLUMNS.map((x) => `co.${x}`).join(',')},
      c.contactname AS customername,
      e.lastname AS employeename
    FROM CustomerOrder AS co
    LEFT JOIN Customer AS c
    ON co.customerId = c.id
    LEFT JOIN Employee AS e
    ON co.employeeid = e.id
    ${whereClause}
    ${sortClause}
    ${paginationClause}`);
}

/**
 * Retrieve a list of CustomerOrder records associated with a particular Customer
 * @param {string} customerId Customer id
 * @param {Partial<OrderCollectionOptions>} opts Options for customizing the query
 */
export async function getCustomerOrders(customerId, opts = {}) {
  let options = {
    ...DEFAULT_CUSTOMER_ORDER_COLLECTION_OPTIONS,
    ...opts
  };
  return getAllOrders(options, sql`WHERE co.customerid = '${customerId}'`);
}

/**
 * Retrieve an individual CustomerOrder record by id
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<Order>} the order
 */
export async function getOrder(id) {
  const db = await getDb();
  return await db.get(
    sql`
    SELECT ${ALL_ORDERS_COLUMNS.map((x) => `co.${x}`).join(',')},
      c.contactname AS customername,
      e.lastname AS employeename,
      SUM((1 - od.discount) * od.unitprice * od.quantity) AS subtotal
    FROM CustomerOrder AS co
    LEFT JOIN Customer AS c ON co.customerId = c.id
    LEFT JOIN Employee AS e ON co.employeeid = e.id
    LEFT JOIN OrderDetail AS od ON od.orderid = co.id
    WHERE co.id = $1`,
    id
  );
}

/**
 * Get the OrderDetail records associated with a particular CustomerOrder record
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<OrderDetail[]>} the order details
 */
export async function getOrderDetails(id) {
  const db = await getDb();
  return await db.all(
    sql`
    SELECT od.*, od.unitprice * od.quantity as price,
      p.productname,
      sum((1 - od.discount) * od.unitprice * od.quantity) as subtotal
    FROM OrderDetail as od
    LEFT JOIN Product as p
    ON od.productid = p.id
    WHERE od.orderid = $1
    GROUP BY od.id, p.productname`,
    id
  );
}

/**
 * Get a CustomerOrder record, and its associated OrderDetails records
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<[Order, OrderDetail[]]>} the order and respective order details
 */
export async function getOrderWithDetails(id) {
  let order = await getOrder(id);
  let items = await getOrderDetails(id);
  return [order, items];
}

/**
 * Create a new CustomerOrder record
 * @param {Pick<Order, 'employeeid' | 'customerid' | 'shipcity' | 'shipaddress' | 'shipname' | 'shipvia' | 'shipregion' | 'shipcountry' | 'shippostalcode' | 'requireddate' | 'freight'>} order data for the new CustomerOrder
 * @param {Array<Pick<OrderDetail, 'productid' | 'quantity' | 'unitprice' | 'discount'>>} details data for any OrderDetail records to associate with this new CustomerOrder
 * @returns {Promise<{id: string}>} the newly created order
 */
export async function createOrder(order, details = []) {
  const db = await getDb();
  await db.run(sql`BEGIN`);
  try {
    const result = await db.run(
      sql`
      INSERT INTO CustomerOrder (employeeid,customerid,shipcity,shipaddress,shipname,shipvia,shipregion,shipcountry,shippostalcode,requireddate,freight)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      order.employeeid,
      order.customerid,
      order.shipcity,
      order.shipaddress,
      order.shipname,
      order.shipvia,
      order.shipregion,
      order.shipcountry,
      order.shippostalcode,
      order.requireddate,
      order.freight
    );
    if (result) {
      let orderId = result.lastID;
      let count = 0;
      await Promise.all(details.map(detail => {
        count++;
        return db.run(
          sql`
          INSERT INTO OrderDetail (id,orderid,productid,quantity,unitprice,discount)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          `${orderId}/${count}`,
          orderId,
          detail.productid,
          detail.quantity,
          detail.unitprice,
          detail.discount
        );
      }));
      await db.run(sql`COMMIT`);
      return {id: orderId};
    }
  } catch(e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
}

/**
 * Delete a CustomerOrder from the database
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<any>}
 */
export async function deleteOrder(id) {
  const db = await getDb();
  return await db.run(
    sql`
    DELETE FROM CustomerOrder
    WHERE id=$1`,
    id
  );
}

/**
 * Update a CustomerOrder, and its associated OrderDetail records
 * @param {string | number} id CustomerOrder id
 * @param {Pick<Order, 'employeeid' | 'customerid' | 'shipcity' | 'shipaddress' | 'shipname' | 'shipvia' | 'shipregion' | 'shipcountry' | 'shippostalcode' | 'requireddate' | 'freight'>} data data for the new CustomerOrder
 * @param {Array<Pick<OrderDetail, 'id' | 'productid' | 'quantity' | 'unitprice' | 'discount'>>} details data for any OrderDetail records to associate with this new CustomerOrder
 * @returns {Promise<Partial<Order>>} the order
 */
export async function updateOrder(id, data, details = []) {
  const db = await getDb();
  await db.run(sql`BEGIN`);
  try {
    await db.run(
      sql`
      UPDATE CustomerOrder SET 
      employeeid = $1,
      customerid = $2,
      shipcity = $3,
      shipaddress = $4,
      shipname = $5,
      shipvia = $6,
      shipregion = $7,
      shipcountry = $8,
      shippostalcode = $9,
      requireddate = $10,
      freight = $11
      WHERE id = $12`,
      data.employeeid,
      data.customerid,
      data.shipcity,
      data.shipaddress,
      data.shipname,
      data.shipvia,
      data.shipregion,
      data.shipcountry,
      data.shippostalcode,
      data.requireddate,
      data.freight,
      id
    );
    await Promise.all(details.map(detail => {
        return db.run(
          sql`
          UPDATE OrderDetail SET
          unitprice=$1,
          quantity=$2,
          productid=$3,
          discount=$4
          WHERE id=$5`,
          detail.unitprice,
          detail.quantity,
          detail.productid,
          detail.discount,
          id
        );
      }));
      await db.run(sql`COMMIT`);
  } catch(e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
}
