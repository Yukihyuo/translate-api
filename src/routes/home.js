import express from "express"
import fs from 'fs/promises';
import path from 'path';
import Dialog from '../models/dialog.js';

const api = express.Router();

const DIALOGS_JSON_PATH = path.join(process.cwd(), '/src/config/dialogs.json');


api.get("/loadData", async (req, res) => {
  const fileContent = await fs.readFile(DIALOGS_JSON_PATH, 'utf-8');
  const file = JSON.parse(fileContent);
  const dialogs = file.text


  await Dialog.insertMany(dialogs)
  res.send(DIALOGS_JSON_PATH)
})

api.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 'es-ES': newTranslation, status } = req.body;
  try {
    const dialog = await Dialog.findById(id);

    if (!dialog) {
      return res.status(404).json({ message: 'Diálogo no encontrado.' });
    }


    dialog['es-ES'] = newTranslation != "" ? newTranslation : dialog['en-US'];
    dialog['en-US'] = newTranslation != "" ? newTranslation : dialog['en-US'];

    // 2. Actualiza el estado
    dialog.status = status;

    // 3. Agrega la nueva entrada al historial
    dialog.history.push({
      old_text: dialog['es-ES'],
      new_text: newTranslation,
      translated_by: "admin", // O el id del usuario que está haciendo la traducción
    });

    await dialog.save();

    res.status(200).json({
      message: 'Diálogo actualizado con éxito.',
      dialogo: dialog,
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      message: 'Error al actualizar el diálogo.',
      error: error.message,
    });
  }
});

api.get('/pending', async (req, res) => {
  try {
    const dialogosPendientes = await Dialog.find({ status: 'pendiente' })
      .limit(20)
      .select('key en-US es-ES status') // Selecciona solo las propiedades que necesitas
      .exec();

    res.status(200).json({
      message: 'Lista de diálogos pendientes.',
      dialogos: dialogosPendientes,
      count: dialogosPendientes.length,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener los diálogos pendientes.',
      error: error.message,
    });
  }
});

api.get('/statistics', async (req, res) => {
  try {
    // Usa `Promise.all` para ejecutar varias consultas a la vez
    const [
      totalCount,
      pendienteCount,
      enProgresoCount,
      traducidoCount,
    ] = await Promise.all([
      Dialog.countDocuments(),
      Dialog.countDocuments({ status: 'pendiente' }),
      Dialog.countDocuments({ status: 'en_progreso' }),
      Dialog.countDocuments({ status: 'traducido' }),
    ]);

    res.status(200).json({
      total_documents: totalCount,
      status_counts: {
        pendiente: pendienteCount,
        en_progreso: enProgresoCount,
        traducido: traducidoCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener las estadísticas.',
      error: error.message,
    });
  }
});


export default api;