const express = require('express');
const cors = require('cors');
const router = require('./routes/api_route.js');

const app = express();

app.use(cors());

app.use(express.json());
app.use(router);

app.use(express.static('FRONTEND'));
app.use('/controllers', express.static('../FRONTEND/controllers'));
app.use('/views', express.static('../FRONTEND/views'));
app.use('/assets', express.static('../FRONTEND/assets'));

module.exports = app;
