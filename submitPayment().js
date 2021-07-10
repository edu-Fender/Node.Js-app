const stripeAPIKey = "sk_test_51J6GidJv72LSDDQAtC0FKAKWEF8AcCbZ3eTF69APf2i4gnQlvmQf5bmLXE1vETnUCa0aB5eKrxnRZpGLUB2tMHrM005mt1npYj"

async function getStripeToken() {
    
  let postBody = {
      "type": "card",
      "card[number]" : '5253185059339046',
      "card[exp_month]" : 10,
      "card[exp_year]" : 26,
      "card[cvc]" : 992
  }
  
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

async function submitPayment(profile, accountID, releaseID, stripeToken = null, isBotProtectionEnabled, loginRequired, isBillingAddressRequired) {

  // Get user
  
  const userResponse = await fetch(window.location.origin + "/ajax/user", {
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
          return "ERROR"
          // throw new Error('Something went wrong')
        }
      })
      .catch((error) => {
      })
  } catch (error) {
    throw new Error('Something went wrong')
  }
  return res
}

// This is the fifth function to run (320)
async function checkStatus(accountID, productName, productCurrency, productPrice, productImage, baseURL, checkoutID) {
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
  if (response.status === 200) {
    console.log(responseJSON)
    // if (licenseKey) {
    if (status == 'failed') {
      // document.title = "Checkout failed"
    } else if (licenseKey != null) {
      var message = licenseKey === '' ? 'Check your email' : licenseKey
      console.log(message)
    }
  }
}

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

async function start(profile) {
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
  console.log(releaseId)


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

    const checkoutID = await submitPayment(profile, accountID, releaseId, stripeToken, isBotProtectionEnabled, loginRequired, isBillingAddressRequired).catch(() => null)

    console.log(checkoutID)
    if (checkoutID !== null && checkoutID !== "undefined" && checkoutID !== "ERROR") {
      console.log("CheckoutID")
      await checkStatus(accountID, productName, productCurrency, productPrice, productImage, baseURL, checkoutID)
    } else if (checkoutID === "ERROR") {
      console.log(loginRequired)
      if (loginRequired) {
        console.log("bug, login required")
      }
    } else if (checkoutID === null || typeof checkoutID === undefined) {
      console.log("should clear the interval")
    }

  } 
}


const profile = {
  "details" : {
    "personInfo" : { 
      "fullName" : "Eduardo Franco",
      "email" : "eduardo@hotmail.com"
    },
    "shippingInfo" : {
      "zipCode" : "20002",
      "country" : "United States",
      "stateCode" : "NY",
      "city" : "New York",
      "addressLine1" : "Broadway, Manhattan",
      "addressLine2" : "Mall Hill street, no.04",
    }
  }
}

// get the url
var hyperURLRegex2 = /(http(?:s)?:\/\/.*)\/purchase\/.*\?password=(.*)/
// https://mistic.metalabs.gg/purchase/l7UvPwy6VBSuWlqXGLXae?password=CometSolutions
// check if the url match the regex it should be (https://)
var urlRegexMatches2 = location.href.match(hyperURLRegex2)
console.log(hyperURLRegex2)
console.log(urlRegexMatches2)
if (urlRegexMatches2) {
  await start(profile)
}

// end


