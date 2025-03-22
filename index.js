const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qlvqjvw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // all collection
    const usersCollection = client.db("nextgen-ecommarce").collection("users");
    const productCollection = client
      .db("nextgen-ecommarce")
      .collection("product");
    // token genarate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCES_TOKEN, {
        expiresIn: "1hr",
      });
      //   console.log("token", token);
      res.send({ token });
    });
    // user svaed database and updated user
    app.put("/users", async (req, res) => {
      const user = req.body;
      //   console.log(user);
      const query = { email: user?.email };
      //   console.log(query);
      // Check if the user exists
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      } else {
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            ...user,
            timestamp: Date.now(),
          },
        };
        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );
        res.send(result);
      }
    });
    // get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // admin role chack
    app.get("/user/:email", async (req, res) => {
      const user = req.body;
      //   console.log(user);
      const email = req.params.email;
      const query = { email };
      //   console.log(query);
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // user role update
    app.patch("/user/update/:email", async (req, res) => {
      const user = req.body;
      const email = req.params.email;
      const query = { email };
      const updateDoc = { $set: { ...user, timestamp: Date.now() } };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // product add
    app.post("/addproduct", async (req, res) => {
      const product = req.body;
      // console.log("product", product);
      const result = await productCollection.insertOne(product);
      // console.log("result", result);
      res.send(result);
    });

    app.get("/allproduct", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello nextgent  Server..");
});

app.listen(port, () => {
  console.log(`nextgen is running on port ${port}`);
});
