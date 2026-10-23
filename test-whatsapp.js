require("dotenv").config();
const { sendWhatsApp } = require("./src/utils/whatsapp");

sendWhatsApp("9508734522", "GigIndia test: WhatsApp notification working!");