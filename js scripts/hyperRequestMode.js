
const stripeAPIKey = "pk_live_51GXa1YLZrAkO7Fk2tcUO7vabkO7sgDamOww2OPYQVFhPZOllT75f7owzIOlP75MMdDXHKoy6wPt40HsuQDObpkHv004T74fAzs";

// This is the second function to run (303)
async function getStripeToken(profile, isBillingAddressRequired) {
  

  let body = new URLSearchParams({
    "type": "card",
    "billing_details[name]": profile.details.personInfo.fullName,
    "billing_details[email]": profile.details.personInfo.email,
    "billing_details[address][postal_code]": profile.details.shippingInfo.zipCode,
    "card[number]": profile.details.paymentInfo.cardNumber,
    "card[cvc]": profile.details.paymentInfo.cvc,
    "card[exp_month]": profile.details.paymentInfo.expiryMonth,
    "card[exp_year]": profile.details.paymentInfo.expiryYearShort
  })

  if (isBillingAddressRequired) {
    body.append("billing_details[address][city]", profile.details.shippingInfo.city)
    body.append("billing_details[address][country]", profile.details.shippingInfo.countryCode)
    body.append("billing_details[address][line1]", profile.details.shippingInfo.addressLine1)
    body.append("billing_details[address][line2]", profile.details.shippingInfo.addressLine2)
    body.append("billing_details[address][state]", profile.details.shippingInfo.stateCode)
  }

  const response = await fetch("https://api.stripe.com/v1/payment_methods", {
    "method": "POST",
    "headers": {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Bearer " + stripeAPIKey
    },
    "body": body
  })

  console.log(response)
  if (response.status === 200) {
    const responseJSON = await response.json()
    return responseJSON.id
  } else if (response.status !== 200) {
    notify('bug', 'Payment Decline', null, 2000)
    return
  }
}

// This is the third function to run (310)
async function submitPayment(profile, accountID, releaseID, stripeToken = null, isBotProtectionEnabled, loginRequired, isBillingAddressRequired) {

  // Get user
  const userResponse = await fetch("/ajax/user", {
    "method": "GET",
    "headers": {
      "hyper-account": accountID
    }
  })
  const userRaw = await userResponse?.text() || null
  const userJson = JSON.parse(userRaw)
  // userId used with submiting payment if login is required
  const userId = userJson?.id

  // this is the normal post body for freee releases and login not required
  const postBody = {
    release: releaseID,
    billing_details: {
      name: profile.details.personInfo.fullName,
      email: profile.details.personInfo.email,
      address: null
    },
  }

  // if the billing address is required then push billing address to post body
  if (isBillingAddressRequired) {
    postBody.billing_details.address = {
      postal_code: profile.details.shippingInfo.zipCode,
      city: profile.details.shippingInfo.city,
      country: profile.details.shippingInfo.country,
      line1: profile.details.shippingInfo.addressLine1,
      line2: profile.details.shippingInfo.addressLine2,
      state: profile.details.shippingInfo.stateCode
    }
  }

  // if login required then push userId to post body
  if (loginRequired) postBody["user"] = userId

  // if stripe token not null then push to post body
  if (stripeToken != null) postBody.payment_method = stripeToken;

  let cf_id = null
  let req_id = null

  if (isBotProtectionEnabled === true) {
    const element = await window.wngProperty('id="purchase"')

    element.dispatchEvent(new Event('click'));

    [cf_id, req_id] = (await getBotdetectionVariables()).split(',')
  }

  try {
    var res = await fetch(window.location.origin + '/ajax/checkouts', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json;charset=UTF-8',
        'Hyper-Account': accountID,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-amz-cf-id': cf_id,
        'x-amz-req-id': req_id,
      },
      body: JSON.stringify(postBody)
    })
      // .then(handleErrors)
      .then(async (response) => {
        console.log(response)
        if (response.status === 200) {
          const responseJSON = await response.json()
          console.log(responseJSON)
          return responseJSON.id
        } else if (response.status !== 200) {
          console.log(response.status)
          notify("bug", "Bad Request", null, 2000)
          return "ERROR"
          // throw new Error('Something went wrong')
        }
      })
      .catch((error) => {
        // console.log(error)
        notify('bug', 'OOS', null, 2000)
        return error;
      })
  } catch (error) {
    throw new Error('Something went wrong')
  }
  return res
}

// This is the fifth function to run (320)
async function checkStatus(accountID, productName, productCurrency, productPrice, productImage, baseURL, checkoutID, controller, timeMS) {
  const response = await fetch(window.location.origin + '/ajax/checkouts/' + checkoutID, {
    method: 'GET',
    headers: {
      'Hyper-Account': accountID,
    }
  })
  console.log(response)
  const responseJSON = await response.json()
  // await new Promise(r => setTimeout(r, 1000))
  const licenseKey = responseJSON?.license?.key || ''
  const status = responseJSON.status
  // console.log(responseJSON)
  const interval = setInterval(async () => {
    if (response.status === 200) {
      console.log(responseJSON)
      // if (licenseKey) {
      clearInterval(interval)
      if (status == 'failed') {
        // document.title = "Checkout failed"
        notify('bug', 'OOS', null, 2000)
      } else if (licenseKey != null) {
        await controller.reportSuccess(productName, productPrice, productCurrency, productImage, null, baseURL, timeMS, licenseKey)
        var message = licenseKey === '' ? 'Check your email' : licenseKey
        notify('success', 'Success', message, 15000)
      }
    }
  }, 20)
}

// This is the fourth function to run (inside submitPayment)
async function getBotdetectionVariables() {
  const codeToInject = `
        (async () => {
            while (true) {
            const cf_id = window.__stripe_xid ? atob(window.__stripe_xid) : null
            const req_id = window.__stripe_eid ? atob(window.__stripe_eid) : null
            if (cf_id || req_id) {
                const variantNode = document.createElement("rise-variant-node")
                variantNode.innerText = cf_id + "," + req_id
                variantNode.style.display = "none"
                document.body.appendChild(variantNode)
                break;
            }
            await (new Promise(r => setTimeout(r, 50)))
        }
        })()
        `

  const script = document.createElement('script')
  script.textContent = codeToInject
  document.head.appendChild(script)

  let variant

  while (!variant) {
    variant = document.querySelector('rise-variant-node')?.innerText

    await (new Promise(r => setTimeout(r, 50)))
  }

  document.querySelector('rise-variant-node').remove()
  return variant
}

// This is the first function to run (290)
async function getReleaseId(buildId) {
  const response = await fetch(window.location.origin + '/_next/data/' + buildId + '/purchase.json?password=', {
    headers: {
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9,ar;q=0.8',
      'if-none-match': 'W/"65b-Pom4TyQ+TJtFlJo0llcjJADMspU"',
      'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
      'sec-ch-ua-mobile': '?0',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    },
    referrer: window.location.origin + '/countdown',
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: null,
    method: 'GET',
    mode: 'cors',
    credentials: 'include'
  })
  console.log(response)
  if (response.status === 200) {
    // pageProps?.release?.id
    const responseJSON = await response.json()
    const releaseId = responseJSON?.pageProps?.release?.id
    return releaseId
  }
}

// This is the main function, all the other functions are calld here
async function start(profile, controller, countdownPage) {
  // Check Page
  const hyperURLRegex = /(http(?:s)?:\/\/.*)\/purchase\/.*\?password=(.*)/
  const urlRegexMatches = location.href.match(hyperURLRegex)

  if (urlRegexMatches) {
    // Retrieve password
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    var password = urlParams.get('password') // e.g. thelabmonthly

    // Retrieve base URL
    var baseURL = window.location.origin // e.g. https://dashboard.the-lab.co.uk
  }

  if (!countdownPage) {
    if (!password || !baseURL) throw 'Not a valid password page'
  }

  var timeMS = new Date()
  // notify
  notify('system', 'Fetching info...', null, 2000)

  // get account info
  const raw = document.querySelector('#__NEXT_DATA__')?.innerText
  const parsed = JSON.parse(raw)
  console.log(parsed);
  // get product name and image for checkout success ** NO NEED WITH CLI BOT **
  const productName = parsed?.props?.pageProps?.account?.name
  const productImage = parsed?.props?.pageProps?.account?.settings?.branding?.logo
  const productPrice = (parseInt(parsed?.props?.pageProps?.release?.plan?.amount) / 100)
  const productCurrency = parsed?.props?.pageProps?.release?.plan?.currency

  // build id is the release build random id for each release
  let buildId = parsed?.buildId

  // stripe account id used to get stripe token / payment method ID ** NOT REQUiRED YET **
  // const stripeAccountID = parsed?.props?.pageProps?.account?.stripe_account

  // account id is the id of the company that makes that release
  const accountID = parsed?.props?.pageProps?.account?.id

  // bot protection
  const isBotProtectionEnabled = parsed?.props?.pageProps?.account?.settings?.bot_protection?.enabled

  // login required each user should be logged in before buying license key
  const loginRequired = parsed?.props?.pageProps?.account?.settings?.payments?.require_login
  console.log(loginRequired)
  // get release info
  const releaseInfo = parsed.props.pageProps.release
  // get release info id
  let releaseId = releaseInfo?.id
  console.log(countdownPage)
  console.log(releaseId)
  if (countdownPage && !releaseId) {
    buildId = parsed?.buildId
    console.log(buildId)
    releaseId = await getReleaseId(buildId)
  }

  let stripeToken = null
  let isBillingAddressRequired = false;
  console.log(releaseInfo?.plan?.type)
  if (releaseInfo?.plan?.type != 'free') {

    // Check if the address is required
    if (document.getElementById("address.country")) {
      isBillingAddressRequired = true
    }

    stripeToken = await getStripeToken(profile, isBillingAddressRequired)
  }
  console.log(stripeToken)
  if (stripeToken != null || releaseInfo?.plan?.type === 'free' || !releaseInfo?.plan?.type) {
    // notify
    notify('system', 'Submiting payment...', null, 2000)

    const checkoutID = await submitPayment(profile, accountID, releaseId, stripeToken, isBotProtectionEnabled, loginRequired, isBillingAddressRequired).catch(() => null)
    console.log(checkoutID)
    const interval = setInterval(async () => {
      console.log(checkoutID)
      if (checkoutID !== null && checkoutID !== "undefined" && checkoutID !== "ERROR") {
        console.log("CheckoutID")
        clearInterval(interval)
        // notify
        timeMS = ((new Date()).getTime() - timeMS.getTime())
        await checkStatus(accountID, productName, productCurrency, productPrice, productImage, baseURL, checkoutID, controller, timeMS)
      } else if (checkoutID === "ERROR") {
        clearInterval(interval)
        console.log(loginRequired)
        if (loginRequired) {
          notify('bug', 'Login required', null, 2000)
        }
      } else if (checkoutID === null || typeof checkoutID === undefined) {
        clearInterval(interval)
      }
    }, 20)
  } else {
    controller.reportDecline(productName, null, null, productImage)
  }
}

// var timeMS = new Date();
(async () => {
  await waitForWindow()
  console.log('hyperRequestMode')
  const profile = await window.getCurrentProfile()
  const controller = new window.ScriptController('hyperRequestMode')

  if (await controller.isFeatureActive('enabled')) {
    var countdownPage = false

    // total Millisecond for success report (how long time takes to checkout) ** NO NEED WITH CLI BOT **
    let totalMS = 0

    // This is countdown page ** https://riseaio.com/countdown ** opens a page with timer, after countdown end redirect to the payment page
    // hyperURLRegex to check if the page that opens is a countdown page
    const hyperURLRegex = /(http(?:s)?:\/\/.*)\/countdown/
    const urlRegexMatches = location.href.match(hyperURLRegex)
    if (urlRegexMatches) {
      if (window.location.href === urlRegexMatches[0]) {
        // console.log("countdown");
        // console.log(document.querySelectorAll("p[class=\"text-4xl sm:text-6xl font-semibold text-gray-700 dark:text-gray-300 font-mono\"]")[0].innerText);
        const time = document.querySelectorAll('p[class="text-4xl sm:text-6xl font-semibold text-gray-700 dark:text-gray-300 font-mono"]')[0]?.innerText
        const days = time.slice(0, 2)
        const hours = time.slice(3, 5)
        const minutes = time.slice(6, 8)
        const seconds = time.slice(9)
        console.log(time)
        console.log(days + ' ' + hours + ' ' + minutes + ' ' + seconds)
        if (days > 0) {
          totalMS += (days * 86400000)
        }
        if (hours > 0) {
          totalMS += (hours * 3600000)
        }
        if (minutes > 0) {
          totalMS += (minutes * 60000)
        }
        if (seconds > 0) {
          totalMS += (seconds * 1000)
        }
      }
    } else if (getInnerText('oos', true)) { // if it's out of stock the page will display a message with OOS
      console.log('oos')
    }

    await new Promise(r => setTimeout(r, (totalMS)))

    if (urlRegexMatches) {
      countdownPage = true
    }

    // this is the main code
    // The interval is like a loop make it work each 20ms
    const interval = setInterval(async () => {
      // get the url
      var hyperURLRegex2 = /(http(?:s)?:\/\/.*)\/purchase\/.*\?password=(.*)/
      // https://mistic.metalabs.gg/purchase/l7UvPwy6VBSuWlqXGLXae?password=CometSolutions
      // check if the url match the regex it should be (https://)
      var urlRegexMatches2 = location.href.match(hyperURLRegex2)
      console.log(hyperURLRegex2)
      console.log(urlRegexMatches2)
      if (urlRegexMatches2) {
        clearInterval(interval)
        await start(profile, controller, countdownPage)
      }
    }, 20)
    // end

    // test
    // try {
    //     console.log("start")
    //     await start(profile, controller)
    // } catch (e) {
    //     console.log(e)
    //     chrome.extension.onMessage.addListener(async (message, _, sendResponse) => {
    //         if (message?.message === "tabChange") {
    //             await start(profile)
    //         }

    //         return sendResponse(true)
    //     })
    // }
  }
})()
