const express = require("express") 
const app = express()
const cors = require("cors")
const dotenv = require("dotenv")
const {client}  = require('./src/config/db');
const authenticateUser = require('./src/middleware/AuthMiddleware');
app.use(express.json());
app.use(cors())


dotenv.config()




// const RoleRoutes = require("../InfluSaga/src/routes/RoleRoutes")
// app.use('/roles', RoleRoutes);


const UserRoutes = require("./src/routes/UserRoutes");
const { config } = require("@dotenvx/dotenvx");
app.use('/user', UserRoutes)

const PDRoutes = require("./src/routes/PDRoutes")
app.use('/user', PDRoutes);

const VendorRoutes = require("./src/routes/VendorRoute");
app.use('/vendor', VendorRoutes);

const VandorPDRoutes = require("./src/routes/VendorPDRoutes")
app.use('/vendor', VandorPDRoutes);


const PORT = 3001
app.listen(PORT,()=>{
    console.log("server started on",PORT)
})