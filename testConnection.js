import mysql from 'mysql2/promise';
import fs from 'fs';

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'Whoon',
      password: process.env.DB_PASSWORD || 'Meubilex123!',
      database: process.env.DB_NAME || 'PortalWH',
    });
    const [rows] = await conn.query('SHOW TABLES');
    fs.writeFileSync('/tmp/testConnection.txt', JSON.stringify(rows, null, 2));
    await conn.end();
  } catch (err) {
    fs.writeFileSync('/tmp/testConnection.txt', 'ERROR:'+err);
  }
})();
