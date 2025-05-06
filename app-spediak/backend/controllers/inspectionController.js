const { Pool } = require('pg');

// Configurar el pool de conexiones usando la variable de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para algunas conexiones remotas como Neon/Heroku, ajusta según necesidad
  }
});

// Controlador de inspecciones (usaremos una lista temporal como simulación de base de datos)

let inspections = []; // Aquí se guardarán temporalmente

const getInspections = async (req, res) => {
  const userId = req.auth.userId; // Obtener userId del middleware
  if (!userId) { // Doble chequeo por si acaso
    return res.status(401).json({ message: 'Not authorized' });
  }
  try {
    // Filtrar por user_id
    const result = await pool.query('SELECT * FROM inspections WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    // const result = await pool.query('SELECT * FROM inspections ORDER BY created_at DESC'); // Temporal: Obtiene todas
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inspections:', err);
    return res.status(500).json({ message: 'Error fetching inspections' });
  }
};

const createInspection = async (req, res) => {
  const userId = req.auth.userId;
  // Remove attempts to get name/email from auth context
  // const userName = req.auth.userName || null;
  // const userEmail = req.auth.userEmail || null;

  if (!userId) {
     return res.status(401).json({ message: 'Not authorized' });
  }

  // Get userState from payload if needed, or ignore it
  const { description, ddid, imageUrl /*, userState */ } = req.body;

  if (!description) {
    return res.status(400).json({ message: 'Missing description' });
  }

  try {
    // Remove user_name, user_email from INSERT
    const result = await pool.query(
      'INSERT INTO inspections (user_id, description, ddid, image_url) VALUES ($1, $2, $3, $4) RETURNING *', // Removed user_name, user_email columns
      [userId, description, ddid, imageUrl] // Removed userName, userEmail parameters
      // If saving state: 'INSERT INTO inspections (..., state) VALUES (..., $5) RETURNING *',
      // If saving state: [..., userState] 
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating inspection:', err);
    return res.status(500).json({ message: 'Error creating inspection' });
  }
};

const deleteInspection = async (req, res) => {
  const userId = req.auth.userId; // Obtener userId del middleware
  if (!userId) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  // const userId = 'temp_user_id'; // Temporal

  const { id } = req.params;
  try {
    // Verificar si la inspección pertenece al usuario antes de borrar
    // Usamos RETURNING para obtener el id borrado y WHERE para filtrar por usuario
    const result = await pool.query('DELETE FROM inspections WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);

    if (result.rowCount === 0) {
       // Si no se borró nada, puede ser porque no existe O no pertenece al usuario
      return res.status(404).json({ message: 'Inspection not found or not authorized' });
    }

    // const result = await pool.query('DELETE FROM inspections WHERE id = $1 RETURNING id', [id]); // Añadido RETURNING para verificar si se borró algo

    // if (result.rowCount === 0) {
    //   return res.status(404).json({ message: 'Inspection not found' });
    // }

    return res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting inspection:', err);
    return res.status(500).json({ message: 'Error deleting inspection' });
  }
};

module.exports = {
  getInspections,
  createInspection,
  deleteInspection,
};
