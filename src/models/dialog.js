// src/models/Dialog.js
import mongoose from 'mongoose';
import randomId from 'random-id';

const { Schema, model } = mongoose;

const dialogsSchema = new Schema({
    _id: {
        type: String,
        default: () => randomId(10), // Genera un ID corto de 10 caracteres
    },
    key: {
        type: String,
        required: true,
        trim: true,
    },
    'en-US': {
        type: String,
        default: null,
        trim: true,
    },
    'es-ES': {
        type: String,
        default: null,
        trim: true,
    },
    status: {
        type: String,
        enum: ['pendiente', 'en_progreso', 'traducido'],
        default: 'pendiente',
    },
    history: {
        type: [
            {
                translated_by: {
                    type: String,
                    default: 'admin',
                },
                old_text: {
                    type: String,
                    default: null,
                },
                new_text: {
                    type: String,
                    default: null,
                },
                translated_at: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        default: [],
    },
});

dialogsSchema.index({ key: 1 });

const Dialog = model('Dialog', dialogsSchema);

export default Dialog;