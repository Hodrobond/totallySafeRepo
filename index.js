const puppeteer = require('puppeteer');
const utils = require('./utils')

const userEmail = '' // insert walmart email
const userPassword = '' // insert walmart password
const productPathName = encodeURIComponent('/ip/Flash-Card-Multiplication-0-12-Flashcards-Other/206336') // insert the product pathname
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
  }) {
    return this[type](opts)
  }

  async rules(stack) {
    console.log('stack')
    console.log(stack)
    const operations = stack.map(this.evaluateRule.bind(this))
    console.log('got operations')
    const firstEvaluated = await Promise.any(operations)
    return firstEvaluated

  }

  async evaluateRule({ condition, action, goto }) {
    console.log('evaluating')
    console.log(condition)
    console.log(action)
    console.log(goto)
    let evaluated
    if (condition) {
      evaluated = await this.evaluateCondition(condition)
    } else {
      evaluated = true
    }
    if (evaluated) {
      await this.performAction(action)
      if (goto) return goto
    }
  }

  async evaluateCondition({ type, opts }) {
    return this[type](opts)
  }

  async performAction({ type, opts }) {
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

  async refresh({ opts, pageIndex = 0 }) {
    await this.pages[pageIndex].refresh()
  }

  async getButtonWithText({ text, pageIndex = 0, disabled = false } = {}) {
    console.log('Get button:', text)
    try {
      const [button] = await this.pages[pageIndex].$x(`//button[contains(., '${text}')][not(@disabled)]`);
      console.log('successfully  got  the  button')
      return button
    } catch (err) { console.log(err) }
  }

  async typeText({ selector, text, pageIndex = 0 } = {}) {
    console.log('TYPE:', text)
    await this.pages[pageIndex].type(selector, text)
  }

  async pressButton({ text, waitForNavigation, pageIndex = 0 } = {}) {
    console.log('Press button:', text)
    let button = await this.getButtonWithText({ text })
    if (button) {
      await button.click()
    }
    if (waitForNavigation) {
      await this.pages[pageIndex].waitForNavigation()
    }
    return true
  }

  async getElement({ element, pageIndex = 0 } = {}) {
    console.log('Get Element:', element)
    const pageElement = await this.pages[pageIndex].$(element)
    return pageElement
  }

  async waitForUrlElement({ element, pageIndex = 0 } = {}) {
    const url = this.pages[pageIndex].url()
    let counter = 0
    while (!url.includes(element) && counter < 10) {
      await delay(1000)
      url = this.pages[pageIndex].url()
      counter++
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
    console.log('product is out of stock')
    page.refresh(true)
    await utils.delay(1000)
    timer++
  }
  console.log('product is in stock!!')
}

// Needs logic  for if we are already signed in
const login = {
  goToLoginPage: {
    condition: null,
    action: {
      type: 'goto',
      opts: {
        url: loginPageUrl
      }
    },
    goto: ['typeEmail']
  },
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
        waitForNavigation: true
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
  waitForNavigationToCart: {
    condition: null,
    action: {
      type: 'waitForNavigation'
    },
    goto: ['cartFlow1']
  },
  checkCartFull: {
    condition: {
      type: "getElement",
      opts: {
        element: '.max-quantity-msg'
      }
    },
    action: {
      type: 'goto',
      opts: {
        url: checkoutPageUrl
      }
    },
    goto: ['cartFlow1']
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
    }
  }
  // cartFlow: { ...logic for traversing through cart and checkout }
}

const start = async (index) => {
  const container = new Container()
  await container.launchBrowser(index);
  await container.addPage()
  // maybe check login  somehow?
  let stack = [config2.goToLoginPage]
  let counter = 0
  while (stack.length && counter < 30) {
    const result = await container.rules(stack)
    console.log('result')
    console.log(result)
    if (Array.isArray(result)) {
      stack = result.map(name => config2[name])
    } else if (result) {
      stack = [config2[result]]
    } else {
      console.log('Done')
    }
    counter++
  }
}

(async () => {
  const limit = 1
  for (let i = 0; i < limit; i++) {
    start(i)
  }
})()
