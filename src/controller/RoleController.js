// const roles = require("../model/RoleModel")
// const client = require("F:/InfluSaga/app")
// exports.getAllRoles = async (req, res) => {
//   try {
//     const result = await client.query(`SELECT * FROM ins.roles WHERE deletedDate IS NULL`);
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ✅ Get Role by ID
// exports.getRoleById = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const result = await client.query(`SELECT * FROM ins.roles WHERE id = $1 AND deletedDate IS NULL`, [id]);
//     if (result.rows.length === 0) return res.status(404).json({ message: 'Role not found' });
//     res.json(result.rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ✅ Create Role
// exports.createRole = async (req, res) => {
//   const { name, isActive } = req.body;
//   try {
//     const result = await client.query(
//       `INSERT INTO roles (name, isActive) VALUES ($1, $2) RETURNING *`,
//       [name, isActive]
//     );
//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ✅ Update Role
// exports.updateRole = async (req, res) => {
//   const { id } = req.params;
//   const { name, isActive } = req.body;
//   try {
//     const result = await client.query(
//       `UPDATE ins.roles SET name = $1, isActive = $2, modifiedDate = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
//       [name, isActive, id]
//     );
//     if (result.rowCount === 0) return res.status(404).json({ message: 'Role not found' });
//     res.json(result.rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ✅ Soft Delete Role
// exports.deleteRole = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const result = await client.query(
//       `UPDATE roles ins.SET deletedDate = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
//       [id]
//     );
//     if (result.rowCount === 0) return res.status(404).json({ message: 'Role not found or already deleted' });
//     res.json({ message: 'Role soft-deleted' });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

