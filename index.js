const puppeteer = require('puppeteer');

const productEndpoint = encodeURIComponent('/ip/Flash-Cards-Numbers-1-100-School-Zone/1525638')
const loginPageUrl = `https://www.walmart.com/account/login?returnUrl=${productEndpoint}`
const productPageUrl = 'https://www.walmart.com/ip/Flash-Cards-Numbers-1-100-School-Zone/1525638'
const checkoutPageUrl = 'https://www.walmart.com/checkout'

///Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')
const websocketUrls = [
  'ws://127.0.0.1:9222/devtools/browser/1d29af26-9891-45e0-adee-163e4eaba2a2',
  'ws://127.0.0.1:9111/devtools/browser/5bdaaf3d-b161-4ccf-8096-38b06ddef776',
  'ws://127.0.0.1:9112/devtools/browser/ee8f5955-bfdf-41ff-a1a0-95af39e43772'
]
let websocketIndex = 0

const signInText = 'Sign in'
const addToCartText = 'Add to cart'
const checkoutText = 'Check out'
const continueText = 'Continue'
class Container {
  constructor() {
    this.browser = null
    this.pages = []
  }

  async launchBrowser(chromeWebsocket) {
    // this.browser = await puppeteer.launch({
    //   executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    //   headless: false,
    //   // defaultViewport: null,
    //   args: [
    //     '--window-size=10,10'
    //   ]
    // });
    console.log('Connecting to:', websocketUrls[websocketIndex]);
    try {
      this.browser = await puppeteer.connect({
        browserWSEndpoint: websocketUrls[websocketIndex],
      });
    } catch (err) {
      console.log(err)
      throw new Error(err)
    }
    websocketIndex++
  }

  async addPage(url) {
    const page = await this.browser.newPage();
    this.pages.push(page)
    return {
      page,
      index: this.pages.length - 1
    }
  }
  async resizeWindow(page, width, height) {
    await page.setViewport({ height, width });

    // Window frame - probably OS and WM dependent.
    height += 85;
    // Any tab.
    const targets = await this.browser._connection.send(
      'Target.getTargets'
    )

    const target = targets.targetInfos.filter(t => t.attached === true && t.type === 'page')[0]

    // Tab window.
    const { windowId } = await this.browser._connection.send(
      'Browser.getWindowForTarget',
      { targetId: target.targetId }
    );

    // Resize.
    await this.browser._connection.send('Browser.setWindowBounds', {
      bounds: { height, width },
      windowId
    });
  }
}

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time))

const getButtonWithText = async (page, text) => {
  const [button] = await page.$x(`//button[contains(., '${text}')][not(@disabled)]`);
  return button
}

const checkCartFull = async (page) => {
  let isCartFull
  for (let i = 0; i < 30; i++) {
    // [isCartFull] = await page.$x(`div[@class="modal" and .//div[contains(., "You've reached the maximum")]]`)
    isCartFull = await page.$('.max-quantity-msg')
    if (isCartFull) {
      return true
    }
    await delay(2000)
  }
  return false
}

const checkOutOfStock = async (page) => {
  const isOutOfStock = await page.$('.prod-ProductOffer-oosMsg')
  while (isOutOfStock) {
    page.refresh(true)
    await delay(2000)
  }
}

const waitForUrlElement = async (page, element) => {
  let url = page.url()
  while (!url.includes(element)) {
    console.log(`Waiting for URL to include: ${element}`);
    await delay(1000)
    url = page.url()
  }
}

const waitForElement = async (page, element) => {
  let pageElement
  while (!pageElement) {
    console.log(`Waiting for page element ${element}`);
    pageElement = await page.$(element)
    await delay(1000)
  }
}

const start = async () => {
  const container = new Container()
  await container.launchBrowser();
  return container
}

const pressButton = async (page, selector) => {
  console.log(`Getting ${selector} button`)
  let button = await getButtonWithText(page, selector)

  while (!button) {
    await delay(1000)
    button = await getButtonWithText(page, selector)
  }
  await button.click({ force: true })
}

const login = async (container, page) => {
  await page.goto(loginPageUrl, { waitUntil: 'domcontentloaded' })
  await waitForElement(page, '#email')
  await page.type('#email', 'jcast90@me.com')
  await page.type('#password', 'Foundation1?')
  await pressButton(page, signInText)
}

const doThings = async (container, page) => {
  let shortCircuitCartNav = false
  await page.goto(productPageUrl, { waitUntil: 'domcontentloaded' })
  await checkOutOfStock(page)
  await pressButton(page, addToCartText)
  checkCartFull(page).then(async (isFull) => {
    if (isFull) {
      console.log('Cart is full, forcing alternate nav');
      shortCircuitCartNav = true
      await page.goto(checkoutPageUrl)
      await waitForUrlElement(page, 'fulfillment')
      await pressButton(page, continueText)
      // await waitForUrlElement(page, 'shipping-address')
      await waitForElement(page, '.address-grid')
      await pressButton(page, continueText)
      // await waitForUrlElement(page, 'payment')

      container.resizeWindow(page, 1280, 800)
    }
  })
  console.log('Waiting for nav');
  await page.waitForNavigation()
  if (shortCircuitCartNav) {
    console.log('Short circuit exiting to prevent duplicate searches');
    return
  }
  await pressButton(page, checkoutText)
  await waitForUrlElement(page, 'fulfillment')
  await pressButton(page, continueText)
  // await waitForUrlElement(page, 'shipping-address')
  await waitForElement(page, '.address-grid')
  await pressButton(page, continueText)
  // await waitForUrlElement(page, 'payment')

  container.resizeWindow(page, 1792, 1120)
}

(async () => {
  for (let i = 0; i < websocketUrls.length; i++) {
    const container = await start();
    const { page } = await container.addPage()
    await login(container, page)
    doThings(container, page)
  }
})()
