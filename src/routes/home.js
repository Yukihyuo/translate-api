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

    // Función auxiliar para escapar caracteres especiales de la regex
    const escapeRegExp = (string) => {
      // Reemplaza caracteres especiales como [, ], (, ), ., etc., con una barra invertida delante
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const replacements = {
      "[P]": "[p]",
      "[P_]": "[p_]",
      "[R]": "[r]",
      "[LR_]": "[lr_]",
    };

    // Escapamos cada clave antes de unirlas para que la regex funcione
    const escapedKeys = Object.keys(replacements).map(key => escapeRegExp(key));
    const regex = new RegExp(escapedKeys.join('|'), 'gi');

    // Usamos .replace() con una función de callback para aplicar el reemplazo
    const processedText = translatedTextGoogle.replace(regex, (matched) => {
      // El callback recibe la coincidencia exacta. Usamos .toUpperCase() para que coincida con la clave del objeto, sin importar las mayúsculas/minúsculas del texto original.
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

api.get('/downloadTranslate', async (req, res) => {
  const fileContent = await fs.readFile(DIALOGS_JSON_PATH, 'utf-8');
  const file = JSON.parse(fileContent);

  file.text = await Dialog.find().select("key en-US -_id")

  const jsonData = JSON.stringify(file, null, 2); // El 'null, 2' formatea el JSON para que sea legible

  // 2. Establecer las cabeceras de la respuesta HTTP
  // La cabecera Content-Type le dice al navegador que el contenido es un JSON
  res.setHeader('Content-Type', 'application/json');

  // La cabecera Content-Disposition le dice al navegador que descargue el archivo.
  // El valor "attachment" fuerza la descarga, y "filename" le da un nombre.
  res.setHeader('Content-Disposition', 'attachment; filename="collection-data.json"');

  // 3. Enviar los datos al cliente
  // res.send() envía la cadena JSON como cuerpo de la respuesta
  res.send(jsonData);
});


export default api;