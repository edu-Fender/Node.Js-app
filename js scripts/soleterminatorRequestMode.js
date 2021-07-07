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

const stripeAPIKey = "pk_live_jM7jCw4btXMDG4cpA2KBGMo0"

async function getStripeToken(profile) {
    let postBody = new URLSearchParams({
        "type": "card",
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
    const responseJSON = await response.json()
    return responseJSON.id
}

async function submitPayment(controller, profile, stripeToken, password) {
    let postBody = new URLSearchParams({
        "email": profile.details.personInfo.email,
        "name": profile.details.personInfo.fullName,
        "address": profile.details.billingInfo.addressLine1,
        "zipCode": profile.details.billingInfo.zipCode,
        "country": profile.details.billingInfo.countryCode,
        "terms_accepted": "true",
        "pm_id": stripeToken
    })

    if (await controller.isFeatureActive("questionBypass")) postBody.append("question_answer", Math.random().toString(36).substring(7))

    const response = await fetch(`https://api.soleterminator.io/api/purchase?password=${password}`, {
        "method": "POST",
        "headers": {
            "Content-Type": "application/x-www-form-urlencoded",
            "accept": "*/*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9"
        },
        "body": postBody
    })
    const responseStatus = response.status

    return responseStatus === 200 || responseStatus === 302
}

async function start(controller) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const password = urlParams.get('password')

    const profile = await window.getCurrentProfile()

    if (!password) throw "Not a valid password page"

    window.notify("Submitting payment...")

    // Create Stripe token
    const stripeToken = await getStripeToken(profile)

    // Submit payment
    const checkoutStatus = await submitPayment(controller, profile, stripeToken, password)

    if (checkoutStatus) {
        window.notify("Checkout successful!", "SUCCESS")
        await controller.reportSuccess("Sole Terminator", 100, "$", "https://i.imgur.com/Aph6vNf.png")
    } else {
        window.notify("Checkout failed", "WARN")
    }
}

(async () => {
    await waitForWindow()

    const controller = new window.ScriptController("soleterminatorRequestMode")

    if (await controller.isFeatureActive("enabled")) {
        await start(controller)
    }
})()