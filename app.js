const express = require("express") 
const app = express()
const cors = require("cors")
const dotenv = require("dotenv")
const {client}  = require('./src/config/db');
const AuthMiddleware = require('../InfluSage-backend-master/src/middleware/AuthMiddleware');
app.use(express.json());
app.use(cors())


dotenv.config()




// const RoleRoutes = require("../InfluSaga/src/routes/RoleRoutes")
// app.use('/roles', RoleRoutes);


const UserRoutes = require("../InfluSage-backend-master/src/routes/UserRoutes");
const { config } = require("@dotenvx/dotenvx");
app.use('/user', UserRoutes)

const PDRoutes = require("../InfluSage-backend-master/src/routes/PDRoutes")
app.use('/user', PDRoutes);

const VendorRoutes = require("../InfluSage-backend-master/src/routes/VendorRoute");
app.use('/vendor', VendorRoutes);

const VandorPDRoutes = require("../InfluSage-backend-master/src/routes/VendorPDRoutes")
app.use('/vendor', VandorPDRoutes);

// const AuthRoutes = require("../InfluSaga/src/routes")

// const AuthRoutes =require("../InfluSage-backend-master/src/routes/AuthRoutes")
// app.use("/Auth", AuthRoutes)






// app.get("/", (req,res) =>{
//     res.send("hello")
// })


const PORT = 3001
app.listen(PORT,()=>{
    console.log("server started on",PORT)
})