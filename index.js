const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 8000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
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
    const paymentCollection = client
      .db("nextgen-ecommarce")
      .collection("payments");
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
    app.get("/product/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });
    app.delete("/product/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    // review
    app.put("/review/:id", async (req, res) => {
      const { id } = req.params;
      // console.log("id", id);
      const { review, name, image } = req.body;
      // console.log("body", req.body);

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $push: {
            reviews: { review, name, image, date: new Date() },
          },
        };
        const options = { upsert: true }; // Create a document if it doesn't exist

        const result = await productCollection.updateOne(
          filter,
          updateDoc,
          options
        );

        res.status(200).send({
          success: true,
          message: "Review added successfully!",
          result,
        });
      } catch (error) {
        console.error("Error adding/updating review:", error);
        res.status(500).send({ error: "Failed to add/update review." });
      }
    });

    // Payment endpoint
    app.post("/create-payment-intent", async (req, res) => {
      const { totalPrice } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalPrice * 100), // Convert to cents
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Save payment details
    app.post("/save-payment", async (req, res) => {
      const paymentData = req.body;

      try {
        const result = await paymentCollection.insertOne(paymentData);
        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // get by email payment
    app.get("/paymenthistory/:email", async (req, res) => {
      const email = req.params.email;
      // console.log("email", email);
      const query = { "userInfo.email": email };
      // console.log("query", query);

      try {
        const result = await paymentCollection.find(query).toArray();
        // console.log(result);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Error retrieving payment history", error });
      }
    });
    // get all payment
    app.get("/paymenthistory", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });
    // order cancel
    app.delete("/order/cancel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/admin-state", async (req, res) => {
      const user = await usersCollection.estimatedDocumentCount();
      const totalOrder = await paymentCollection.estimatedDocumentCount();
      const result = await paymentCollection.find().toArray();
      const renevue = result.reduce((acc, item) => acc + item.totalPrice, 0);

      res.send({ user, totalOrder, renevue });
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
