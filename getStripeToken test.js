const fetch = require("node-fetch");

const stripeAPIKey = "sk_test_51J6GidJv72LSDDQAtC0FKAKWEF8AcCbZ3eTF69APf2i4gnQlvmQf5bmLXE1vETnUCa0aB5eKrxnRZpGLUB2tMHrM005mt1npYj"

async function getStripeToken() {
    
    let postBody = {
        "type": "card",
        "card[number]" : '4242424242424242',
        "card[exp_month]" : 5,
        "card[exp_year]" : 2025,
        "card[cvc]" : 465
    }
    let postBody1 = "type=card&card[number]=4242424242424242&card[exp_month]=5&card[exp_year]=2025&card[cvc]=465"
    
    const response = await fetch("https://api.stripe.com/v1/payment_methods", {
        "type": "card",
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Bearer ${stripeAPIKey}`
        },
        "body": postBody1
    })

    const responseJSON = await response.json()
    console.log(responseJSON)
    return responseJSON.id
}

getStripeToken();