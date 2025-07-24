const express = require("express") 
const app = express()
const cors = require("cors")
const dotenv = require("dotenv")
const Client  = require('./src/config/db');
app.use(express.json());
app.use(cors())

dotenv.config()




// const RoleRoutes = require("../InfluSaga/src/routes/RoleRoutes")
// app.use('/roles', RoleRoutes);


const UserRoutes = require("../InfluSage-backend-main/src/routes/UserRoutes");
const { config } = require("@dotenvx/dotenvx");
app.use('/user', UserRoutes)





// app.get("/", (req,res) =>{
//     res.send("hello")
// })


const PORT = 3001
app.listen(PORT,()=>{
    console.log("server started on",PORT)
})