const puppeteer = require('puppeteer');
const utils = require('./utils')

const userEmail = 'jcast90@me.com' // insert walmart email
const userPassword = 'April142019' // insert walmart password
// const productPathName = encodeURIComponent('/ip/PlayStation-5-Console/363472942') // insert the product pathname
const productPathName = encodeURIComponent('/ip/Flash-Cards-Numbers-1-100-School-Zone/1525638') // insert the product pathname
const loginPageUrl = `https://www.walmart.com/account/login?returnUrl=${productPathName}`
// const productPageUrl = 'https://www.walmart.com/ip/Sony-PlayStation-5-Digital-Edition/493824815'
// const productPageUrl = 'https://www.walmart.com/ip/PlayStation-5-Console/363472942'
const productPageUrl = 'https://www.walmart.com/ip/Flash-Cards-Numbers-1-100-School-Zone/1525638'
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
  }) {
    return this[type](opts)
  }

  async rules(stack) {
    const operations = stack.map(this.evaluateRule.bind(this))
    const firstEvaluated = await Promise.any(operations).catch(e => {
      console.log('Stack broke here')
      console.log(stack)
    })
    return firstEvaluated
  }
  /*
  condition: {
    type: "elementExists",
    opts: {
      selector: "",
      disabled: false,
    },
    required: true
  },
  */
  async evaluateRule({ condition, action, goto }) {
    let evaluated
    if (condition) {
      evaluated = await this.evaluateCondition(condition)
    } else {
      evaluated = true
    }
    if (evaluated) {
      await this.performAction(action)
      console.log('Performed:', action)
      console.log('Returning:', goto)
      if (goto) return goto
    }
  }

  async evaluateCondition({ type, opts }) {
    return this[type](opts)
  }

  async performAction({ type, opts }) {
    return this[type](opts)
  }

  async maxItems({ element, pageIndex = 0 } = {}) {
    return Number(this.getElement({ element, pageIndex })) === 0
  }

  async launchBrowser(index) {
    try {
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
    await this.pages[pageIndex].goto(url, {
      timeout: 0,
      ...opts,
    })
    return true
  }

  async refresh({ opts, pageIndex = 0 }) {
    await this.pages[pageIndex].refresh()
  }

  async setLocalStorage({ key, value, pageIndex = 0 }) {
    console.log('hit setting  localstorage')
    const tempKey = key
    const tempValue = value
    await this.pages[pageIndex].evaluate((tempKey, tempValue) => {
      localStorage.setItem(tempKey, tempValue);
    });
  }

  async getLocalStorage(key, page) {
    const tempKey = key
    return await page.evaluate((tempKey) => {
      console.log('hit', tempKey)
      return localStorage.getItem(tempKey);
    });
  }

  async getButtonWithText({ text, pageIndex = 0, disabled = false } = {}) {
    let button
    while (!button) {
      [button] = await this.pages[pageIndex].$x(`//button[contains(., '${text}')][not(@disabled)]`);
    }
    console.log('RETURNING BUTTON')
    return button
  }

  async typeText({ selector, text, pageIndex = 0 } = {}) {
    await this.pages[pageIndex].type(selector, text)
  }

  async pressButton({ text, waitForNavigation, pageIndex = 0 } = {}) {
    console.log('Pressing button')
    let button = await this.getButtonWithText({ text })
    if (button) {
      console.log('found button with text:', text)
      await button.click()
    }
    if (waitForNavigation) {
      console.log('waiting for nav')
      await this.pages[pageIndex].waitForNavigation()
    }
    console.log('RETURNING PRESS BUTTON')
    return true
  }

  async waitForNavigation({ pageIndex = 0 }) {
    await this.pages[pageIndex].waitForNavigation()
  }

  async getElement({ element, pageIndex = 0 } = {}) {
    let pageElement
    while (!pageElement) {
      pageElement = await this.pages[pageIndex].$(element)
    }
    console.log('RETURNING ELEMENT')
    return pageElement
  }

  async waitForUrlElement({ element, pageIndex = 0 } = {}) {
    console.log('Waiting for URL element:', element)
    const url = this.pages[pageIndex].url()
    while (!url.includes(element)) {
      await delay(1000)
      url = this.pages[pageIndex].url()
    }
    return true
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
    page.refresh(true)
    await utils.delay(1000)
    timer++
  }
  console.log('product is in stock!!')
}

const login = {
  typeEmail: {
    condition: {
      type: "getElement",
      opts: {
        element: '#email'
      }
    },
    action: {
      type: 'typeText',
      opts: {
        selector: '#email',
        text: userEmail
      }
    },
    goto: ['typePassword']
  },
  typePassword: {
    condition: {
      type: "getElement",
      opts: {
        element: '#password'
      }
    },
    action: {
      type: 'typeText',
      opts: {
        selector: '#password',
        text: userPassword
      }
    },
    goto: ['setLocalStorage']
  },
  setLocalStorage: {
    condition: null,
    action: {
      type: 'setLocalStorage',
      opts: {
        key: 'isLoggedIn',
        value: 'true'
      }
    },
    goto: ['signIn']
  },
  signIn: {
    condition: null,
    action: {
      type: 'pressButton',
      opts: {
        text: signInText,
        waitForNavigation: true,
      }
    },
    goto: ['canAddToCart', 'addToCartDisabled']
  },
}

const config2 = {
  ...login,
  goToProductPage: {
    condition: null,
    action: {
      type: 'goto',
      opts: {
        url: productPageUrl
      }
    },
    goto: ['canAddToCart', 'addToCartDisabled']
  },
  canAddToCart: {
    condition: {
      type: "getButtonWithText",
      opts: {
        text: "Add to cart",
        disabled: false,
      },
    },
    action: {
      type: "pressButton",
      opts: {
        text: "Add to cart",
      }
    },
    goto: ['checkCartFull', 'cartFlow1'],
  },
  addToCartDisabled: {
    condition: {
      type: "getButtonWithText",
      opts: {
        text: "Add to cart",
        disabled: true,
      },
    },
    action: {
      type: "refresh"
    },
    goto: ['canAddToCart', 'addToCartDisabled']
  },
  checkCartFull: {
    condition: {
      type: "getElement",
      opts: {
        element: '[data-automation-id="count"]'
      }
    },
    action: {
      type: 'goto',
      opts: {
        url: checkoutPageUrl
      }
    },
    goto: ['checkoutFlow1']
  },
  cartFlow1: {
    condition: {
      type: 'getButtonWithText',
      opts: {
        text: 'Check out',
        disabled: false,
      }
    },
    action: {
      type: 'pressButton',
      opts: {
        text: 'Check out'
      }
    },
    goto: ['checkoutFlow1']
  },
  checkoutFlow1: {
    condition: {
      type: 'waitForUrlElement',
      opts: {
        element: 'fulfillment'
      }
    },
    action: {
      type: 'pressButton',
      opts: {
        text: continueText
      }
    },
    goto: ['checkoutFlow2']
  },
  checkoutFlow2: {
    condition: {
      type: 'getElement',
      opts: {
        element: '.address-grid'
      }
    },
    action: {
      type: 'pressButton',
      opts: {
        text: continueText
      }
    }
  }
  // cartFlow: { ...logic for traversing through cart and checkout }
}

const start = async (index) => {
  const container = new Container()
  await container.launchBrowser(index);
  await container.addPage()
  // await page.goto(loginPageUrl)
  // const loggedIn = await container.getLocalStorage('isLoggedIn', page)
  // console.log(loggedIn)
  // let stack = [config2.typeEmail]
  // if (loggedIn) {
  //   stack = [config2.goToProductPage]
  // }
  stack = [config2.goToProductPage]

  while (stack.length) {
    console.log('Stack')
    console.log(stack)
    const result = await container.rules(stack)
    console.log('RESULT')
    console.log(result)
    if (Array.isArray(result)) {
      stack = result.map(name => config2[name])
    } else if (result) {
      stack = [config2[result]]
    } else {
      await utils.delay(1000)
      console.log('Done')
    }
  }
}

(async () => {
  const limit = 5
  for (let i = 0; i < limit; i++) {
    start(i)
  }
})()
