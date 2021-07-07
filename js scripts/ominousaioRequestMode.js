const waitForWindow = () => {
    return new Promise(r => {
        if (window.test) {
            return r()
        }

        const interval = setInterval(() => {
            if (window.test) {
                clearInterval(interval)
                return r()
            }
        }, 75)
    })
}

// this is the stripe token should be used in headers when sending post request to stripe
const stripeAPIKey = "pk_live_51I22Q3Fnw2XCIf3OrDhyttNO94JiUVu7HktRTfoLQj25xrz64Z5BXOwp0jzUt075h2Zryc2hJTbYG7N4Nqov8QNf0024DkgBhQ"

// This is the second function to run, getting stripe token to verify the credit card (the details of the user gets called from the users saved profile)
async function getStripeToken(profile) {
    let postBody = new URLSearchParams({
        "card[number]": profile.details.paymentInfo.cardNumber,
        "card[exp_month]": profile.details.paymentInfo.expiryMonth,
        "card[exp_year]": profile.details.paymentInfo.expiryYearShort,
        "card[cvc]": profile.details.paymentInfo.cvc
    })

    const response = await fetch("https://api.stripe.com/v1/payment_methods", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Bearer ${stripeAPIKey}`
        },
        "body": postBody
    })
    /*
    * Stripe response (JSON Object)
    * {
        "id": "pm_1J6FPz2eZvKYlo2CbOVT1Hsp", (this is the id of the payment method **IMPORTANT** to submit payment)
        "object": "payment_method",
        }
    */

    const responseJSON = await response.json()
    return responseJSON.id
}

// This is the first function to run, getting release info to check if there are licenses still in stock or if it's out of stock
async function getReleaseInfo(password) {
    let postBody = {
        operationName: "FetchRelease",
        query: "query FetchRelease($password: String) {\n  getRelease(password: $password) {\n    id\n    plan {\n      type\n      amount\n      currency\n      interval\n      __typename\n    }\n    stock\n    initialFee\n    trialPeriod\n    rentalPeriod\n    __typename\n  }\n}\n",
        variables: {
            password: password
        }
    }

    const response = await fetch("https://dashboard.ominous.dev/graphql", {
        "method": "POST",
        "mode": "cors",
        "cache": "no-cache",
        "credentials": "same-origin",
        "headers": {
            "accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
            "content-type": "application/json",
            "Host": window.location.host,
            "Origin": window.location.origin,
            "Referer": window.location.href,
        },
        "redirect": "follow",
        "referrer": "no-referrer",
        "body": JSON.stringify(postBody)
    })

    /*
    * Response JSON:
    * { 
    *   getRelease(password: $password) {
    *         id: ""
    *         plan: {
    *               type: ""
    *               amount:
    *               currency: "$"
    *               interval:
    *               __typename:
    *               }
    *       stock:
    *       initialFee:
    *       trialPeriod:
    *       rentalPeriod:
    *       __typename:
    *   }
    * }",
    */
    const responseJSON = await response.json()

    return responseJSON.data.getRelease.id
}

// if the password is currect and still licenses in stock and the payment method is good then submit payment to buy a license
async function submitPayment(profile, stripeToken, password, releaseID) {
    
    let postBody = {
        operationName: "Purchase",
        query: "mutation Purchase($purchaseInput: PurchaseInput!) {\n  purchase(purchase: $purchaseInput) {\n    ok\n    data {\n      status\n      clientSecret\n      __typename\n    }\n    __typename\n  }\n}\n",
        variables: {
            purchaseInput: {
                customerEmail: profile.details.personInfo.email,
                customerName: profile.details.personInfo.fullName,
                id: releaseID,
                password: password,
                stripePaymentMethodId: stripeToken
            }
        }
    }

    const response = await fetch("https://dashboard.ominous.dev/graphql", {
        "method": "POST",
        "mode": "cors",
        "cache": "no-cache",
        "credentials": "same-origin",
        "headers": {
            "accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
            "content-type": "application/json",
            "Host": window.location.host,
            "Origin": window.location.origin,
            "Referer": window.location.href,
        },
        "redirect": "follow",
        "referrer": "no-referrer",
        "body": JSON.stringify(postBody)
    })
    const responseJSON = await response.json()

    return responseJSON.data
}

async function start(profile, controller) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const password = urlParams.get('password')

    if (!password) throw "Not a valid password page"

    window.notify("Fetching info...")

    // Get release information (the ID)
    const releaseID = await getReleaseInfo(password)

    window.notify("Submitting payment...")

    // Create Stripe token
    const stripeToken = await getStripeToken(profile)

    // Submit payment
    const checkoutStatus = await submitPayment(profile, stripeToken, password, releaseID)

    if (checkoutStatus) {
        window.notify("Checkout successful!", "SUCCESS")
        await controller.reportSuccess("ominousAIO", 250, "$", "https://i.imgur.com/6r0vXxm.png")
    } else {
        window.notify("Checkout failed", "WARN")
    }
}

(async () => {
    await waitForWindow()

    const profile = await window.getCurrentProfile()
    const controller = new window.ScriptController("ominousaioRequestMode")

    if (await controller.isFeatureActive("enabled")) {
        await start(profile, controller)
    }
})()