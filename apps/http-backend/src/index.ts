import express from 'express';

const app = express();

app.post("/signup",(req , res) => {

})
app.post("/signin",(req , res) => {

})
app.post("/room",(req , res) => {

})

app.listen(3000, () => {
  console.log('HTTP server is running on port 3000');
});