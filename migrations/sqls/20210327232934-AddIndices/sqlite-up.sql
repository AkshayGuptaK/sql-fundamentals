-- Put your SQLite "up" migration here
-- CREATE INDEX indexname ON TABLE(COLUMN)

CREATE INDEX orderemployeeid ON CustomerOrder(employeeid);
CREATE INDEX ordercustomerid ON CustomerOrder(customerId);
CREATE INDEX orderdetailorderid ON OrderDetail(orderid);
CREATE INDEX orderdetailproductid ON OrderDetail(productid);
CREATE INDEX productsupplierid ON Product(supplierid);
CREATE INDEX employeereportsto ON Employee(reportsto);
