import express from "express"
import fs from 'fs/promises';
import path from 'path';
import translate from "translate"
import Dialog from '../models/dialog.js';

const api = express.Router();
translate.engine = 'google';

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

api.post('/translate', async (req, res) => {
  const textToTranslate = req.body.text;

  if (!textToTranslate) {
    return res.status(400).json({ error: 'El cuerpo de la solicitud debe contener un campo "text".' });
  }

  try {
    const translatedTextGoogle = await translate(textToTranslate, { from: 'en', to: 'es' });

    const replacements = {
      "[P]": "[p]",
      "[R]": "[r]",
      "[P_]": "[p_]"
    };

    const regex = new RegExp(Object.keys(replacements).join('|'), 'gi');

    const processedText = translatedTextGoogle.replace(regex, (matched) => {
      return replacements[matched.toUpperCase()];
    });

    const responseBody = {
      originalText: textToTranslate,
      translations: {
        google: processedText,
      }
    };

    res.json(responseBody);

  } catch (error) {
    console.error('Error al traducir el texto:', error);
    res.status(500).json({ error: 'Hubo un problema al realizar la traducción.', details: error.message });
  }
});


export default api;