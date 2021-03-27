-- Put your SQLite "up" migration here
CREATE UNIQUE INDEX orderdetailuniqueproduct ON OrderDetail(orderid,productid);

CREATE TABLE CustomerOrderTransaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auth VARCHAR(256),
    orderid INTEGER NOT NULL REFERENCES CustomerOrder(id)
);
