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

const stripeAPIKey = "pk_live_CoRu9eKCeKLA85AZFqQ8B5lk002ljSbgQl"

async function getStripeToken(profile) {
    let postBody = new URLSearchParams({
        "card[number]": profile.details.paymentInfo.cardNumber,
        "card[exp_month]": profile.details.paymentInfo.expiryMonth,
        "card[exp_year]": profile.details.paymentInfo.expiryYearShort,
        "card[cvc]": profile.details.paymentInfo.cvc
    })

    const response = await fetch("https://api.stripe.com/v1/tokens", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Bearer ${stripeAPIKey}`
        },
        "body": postBody
    })
    const responseJSON = await response.json()
    return responseJSON.id
}

async function submitPayment(profile, stripeToken, password) {
    let postBody = {
        email: profile.details.personInfo.email,
        password: password,
        token: stripeToken
    }

    const response = await fetch("https://dashboard.shinobi-scripts.com/api/payment/purchase", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/json;charset=UTF-8"
        },
        "body": JSON.stringify(postBody)
    })
    const responseJSON = await response.json()

    return responseJSON.success
}

async function start(profile, controller) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const password = urlParams.get('password')

    if (!password) throw "Not a valid password page"

    window.notify("Submitting payment...")

    // Create Stripe token
    const stripeToken = await getStripeToken(profile)

    // Submit payment
    const checkoutStatus = await submitPayment(profile, stripeToken, password)

    if(checkoutStatus) {
        window.notify("Checkout successful!", "SUCCESS")
        await controller.reportSuccess("Shinobi Scripts", 50, "€", "https://i.imgur.com/yuOF1eg.jpg")
    } else {
        window.notify("Checkout failed", "WARN")
    }
}

(async () => {
    await waitForWindow()

    const profile = await window.getCurrentProfile()
    const controller = new window.ScriptController("shinobiscriptsRequestMode")

    if (await controller.isFeatureActive("enabled")) {
        await start(profile, controller)
    }
})()