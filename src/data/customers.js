import { getDb } from '../db/utils';
import { sql } from '../sql-string';

/**
 * Columns to SELECT for the getAllCustomers query
 */
const ALL_CUSTOMERS_COLUMNS = ['id', 'contactname', 'companyname'];

/**
 * Options that may be used to customize a query for a collection of Customers
 *
 * @typedef CustomerCollectionOptions
 * @property {string} [filter] name filter string
 */

/**
 * Retrieve an array of Customers from the database
 *
 * @export
 * @param {CustomerCollectionOptions} [options={}] Options that influence the particulars of the "all customers" query
 * @returns {Promise<Customer[]>} A collection of customers
 */
export async function getAllCustomers(options = {}) {
  const db = await getDb();
  let whereClause = '';
  if (options.filter) {
    whereClause = sql`WHERE companyname LIKE '%${options.filter}%' OR contactname LIKE '%${options.filter}%'`;
  }
  return db.all(sql`
  SELECT ${ALL_CUSTOMERS_COLUMNS.map((x) => `c.${x}`).join(',')},COUNT(co.id) AS ordercount
  FROM Customer AS c
  LEFT JOIN CustomerOrder AS co ON co.customerid = c.id
  ${whereClause}
  GROUP BY c.id`);
}

/**
 * Retrieve an individual Customer (by Id) from the database
 *
 * @export
 * @param {string | number} id The id of the customer to retrieve
 * @returns {Promise<Customer>} The customer
 */
export async function getCustomer(id) {
  const db = await getDb();
  return db.get(
    sql`
SELECT *
FROM Customer
WHERE id = $1`,
    id
  );
}
