const doten = require('dotenv');
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRETKEY);
const app = express();
const PORT = "8080";

app.use(express.json());
app.use(cors());

app.post('/pay', async (req, res) =>{
    try{
        const {name} = req.body;
        if(!name) return res.status(400).json({message:'Please enter a name'});
        const paymentIntent = await stripe.paymentIntents.create({
            amount:Math.round(25 * 100),
            currency:'USD',
            payment_method_types: ["card"],
            metadata: {name}
        });
        const clientSecret = paymentIntent.client_secret;
        res.json({message:'Payment initiated', clientSecret});
    }catch(err){
        console.log(err);
        res.status(500).json({message: 'Internal server error'});
    }
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));