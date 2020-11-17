const puppeteer = require('puppeteer');
const utils = require('./utils')

const userEmail = '' // insert walmart email
const userPassword = '' // insert walmart password
const productPathName = encodeURIComponent('') // insert the product pathname
const loginPageUrl = `https://www.walmart.com/account/login?returnUrl=${productPathName}`
// const productPageUrl = 'https://www.walmart.com/ip/Sony-PlayStation-5-Digital-Edition/493824815'
const productPageUrl = 'https://www.walmart.com/ip/Flash-Card-Multiplication-0-12-Flashcards-Other/206336'
const checkoutPageUrl = 'https://www.walmart.com/checkout'

const signInText = 'Sign in'
const addToCartText = 'Add to cart'
const checkoutText = 'Check out'
const continueText = 'Continue'
class Container {
  constructor() {
    this.browser = null
    // some pages will probably allow action w/o tab focus
    this.pages = []
  }

  act({
    type,
    opts
  }){
    return this[type](opts)
  }

  async launchBrowser(index) {
    try {
      console.log('LAUNCHING:')
      this.browser = await puppeteer.launch({
        headless: false,
        userDataDir: `~/Documents/Chrome_data/${index}`,
      })
    } catch (err) {
      console.log(err)
      throw new Error(err)
    }
  }

  async addPage() {
    const page = await this.browser.newPage();
    this.pages.push(page)
    return {
      page,
      index: this.pages.length - 1
    }
  }
  // Page nav utils
  async goto({ url, opts, pageIndex = 0 } = {}) {
    console.log('GOTO:', url)
    await this.pages[pageIndex].goto(url, {
      timeout: 0,
      ...opts,
    })
    return true
  }

  async getButtonWithText({ text, pageIndex = 0, disabled = false } = {}) {
    console.log('Get button:', text)
    const [button] = await this.pages[pageIndex].$x(`//button[contains(., '${text}')][not(@disabled)]`);
    return button
  }

  async typeText({ selector, text, pageIndex = 0 } = {}) {
    console.log('TYPE:', text)
    await this.pages[pageIndex].type(selector, text)
  }

  async pressButton({ text, waitForNavigation } = {}){
    console.log('Press button:', text)
    let button = await this.getButtonWithText({ text })
    if (button) {
      await button.click()
    }
    if (waitForNavigation) {
      await page.waitForNavigation()
    }
    return button
  }

  async getElement({ element, pageIndex = 0 } = {}) {
    console.log('Get Element:', element)
    const pageElement = await this.pages[pageIndex].$(element)
    return pageElement
  }

  async waitForUrlElement({ element, pageIndex = 0 } = {}) {
    console.log('Wait for URL:', element)
    const url = this.pages[pageIndex].url()
    console.log('is it there?:', url)
    return url.includes(element)
  }

  // Other utils
  async resizeWindow({ pageIndex = 0, width = 1280, height = 800 } = {}) {
    await this.pages[pageIndex].setViewport({ height, width });
    height += 85;
    const targets = await this.browser._connection.send(
      'Target.getTargets'
    )
    const target = targets.targetInfos.filter(t => t.attached === true && t.type === 'page')[0]
    const { windowId } = await this.browser._connection.send(
      'Browser.getWindowForTarget',
      { targetId: target.targetId }
    );
    await this.browser._connection.send('Browser.setWindowBounds', {
      bounds: { height, width },
      windowId
    });
  }
}

const checkCartFull = async (page) => {
  let isCartFull
  for (let i = 0; i < 30; i++) {
    // [isCartFull] = await page.$x(`div[@class="modal" and .//div[contains(., "You've reached the maximum")]]`)
    isCartFull = await page.$('.max-quantity-msg')
    if (isCartFull) {
      return true
    }
    await utils.delay(2000)
  }
  return false
}

const checkOutOfStock = async (page) => {
  const isOutOfStock = await page.$('.prod-ProductOffer-oosMsg')
  while (isOutOfStock) {
    console.log('product is out of stock')
    page.refresh(true)
    await utils.delay(1000)
    timer++
  }
  console.log('product is in stock!!')
}

const login = [
  {
    type: 'goto',
    opts: {
      url: 'https://www.walmart.com/account/login'
    }
  },
  {
    type: 'typeText',
    opts: {
      selector: '#email',
      text: userEmail
    }
  },
  {
    type: 'typeText',
    opts: {
      selector: '#password',
      text: userPassword
    }
  },
  {
    type: 'pressButton',
    opts: {
      text: signInText,
      waitForNavigation: true,
    }
  }
]

const config = [
  // ...login,
  {
    type: 'goto',
    opts: {
      url: productPageUrl
    }
  },
  {
    type: 'pressButton',
    opts: {
      text: addToCartText,
    },
    wait: true,
  },
  {
    type: 'goto',
    opts: {
      url: checkoutPageUrl,
    },
    skip: 1
  },
  {
    type: 'waitForUrlElement',
    opts: {
      element: 'fulfillment',
    },
    wait: true,
  },
  {
    type: 'pressButton',
    opts: {
      text: continueText,
    },
    wait: true,
  },
  {
    type: 'getElement',
    opts: {
      element: '.address-grid',
    },
    wait: true,
  },
  {
    type: 'pressButton',
    opts: {
      text: continueText,
    },
    wait: true,
  },
  {
    type: 'resizeWindow',
    wait: true,
  }
]

const start = async (index) => {
  const delay = 1000
  const container = new Container()
  await container.launchBrowser(index);
  await container.addPage()
  const tempConfig = [...config]
  while(tempConfig.length) {
    const actor = tempConfig.shift()
    const result = await container.act(actor)
    if (actor.wait && !result) {
      tempConfig.unshift(actor)
      await utils.delay(delay)
    }
  }
}

(async () => {
  const limit = 5
  // const sockets = await utils.openNWebsockets(limit)
  // console.log('got sockets:', sockets)
  for (let i = 0; i < limit; i++) {
    start(i)
  }
})()
