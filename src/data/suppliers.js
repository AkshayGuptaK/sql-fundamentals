import { getDb } from '../db/utils';
import { sql } from '../sql-string';

/**
 * Columns to select in the `getAllSuppliers` query
 */
const ALL_SUPPLIERS_COLUMNS = ['id', 'contactname', 'companyname'];

/**
 * Retrieve a collection of all Supplier records from the database
 * @return {Promise<Supplier[]>}
 */
export async function getAllSuppliers() {
  const db = await getDb();
  return db.all(sql`
    SELECT ${ALL_SUPPLIERS_COLUMNS.map((x) => `s.${x}`).join(',')},
      group_concat(p.productname, ", ") as productlist
    FROM Supplier as s
    LEFT JOIN (SELECT * FROM Product ORDER BY productname) AS p ON p.supplierid = s.id
    GROUP BY s.id, s.contactname, s.companyname
  `);
}

/**
 * Retrieve an individual Supplier record from the database, by id
 * @param {string|number} id Supplier id
 * @return {Promise<Supplier>} the supplier
 */
export async function getSupplier(id) {
  const db = await getDb();
  return db.get(
    sql`
SELECT *
FROM Supplier
WHERE id = $1`,
    id
  );
}
