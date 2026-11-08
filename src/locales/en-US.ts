// Every string the storefront shows. Plurals use vue-i18n's pipe syntax ("zero | one | many");
// a literal @ must be written {'@'} (a bare @ starts a linked message).
export default {
    app: {
        name: 'Sellout Pizza',
        homeLabel: 'Sellout Pizza home',
        copyright: '© {year} Sellout Pizza',
    },

    titles: {
        home: 'Order pizza for pickup',
        cart: 'Your cart',
        orderComplete: 'Your order',
        about: 'About',
        unsubscribe: 'Unsubscribe',
        notFound: 'Page not found',
    },

    nav: {
        home: 'Home',
        about: 'About',
        footer: 'Footer navigation',
        backToMenu: 'Back to the menu',
    },

    common: {
        loading: 'Loading…',
        retry: 'Retry',
        dismiss: 'Dismiss',
        undo: 'Undo',
    },

    status: {
        open: 'Open now',
        soldOut: 'Sold out',
        closed: 'Closed',
        checking: 'Checking…',
    },

    service: {
        stale: "We couldn't load the latest service info. What you see may be out of date.",
    },

    hero: {
        eyebrow: 'Open now',
        title: 'Accepting orders',
        openUntil: 'Open until {time}, or until we sell out.',
        remaining: 'Pizzas remaining',
        remainingSr: '{n} pizza remaining | {n} pizzas remaining',
        reserve: 'Order now to reserve yours',
    },

    pickup: {
        heading: 'Pickup at',
        only: 'Pickup only.',
        call: 'Call {phone}',
        directions: 'Get directions',
    },

    menu: {
        title: 'Menu',
        maxPerOrder: 'Max {n} pizza per order | Max {n} pizza per order | Max {n} pizzas per order',
        unavailable: 'Menu not available yet.',
        order: 'Order',
        orderItem: 'Order {title}',
        adding: 'Adding…',
        outOfStock: 'Out of stock',
        outOfStockItem: '{title} is out of stock',
        quantityFor: 'Quantity of {title}',
        added: '{title} added to your cart | {title} added to your cart | {n} × {title} added to your cart',
        viewCart: 'View cart',
    },

    cartBar: {
        label: 'View cart',
        count: '· {n} pizza | · {n} pizza | · {n} pizzas',
    },

    cartIndicator: {
        label: 'Cart, no pizzas | Cart, {n} pizza | Cart, {n} pizzas',
    },

    closed: {
        soldOut: "We're sold out for tonight",
        closed: "We're closed right now",
        nextService: 'Next service',
        noService: 'No service scheduled',
        checkBack: 'Check back soon for the next open window.',
    },

    subscribe: {
        prompt: "Get an email when we're next open.",
        emailLabel: 'Email address',
        placeholder: "you{'@'}example.com",
        submit: 'Notify me',
        submitting: 'Subscribing…',
        success: "You're subscribed! We'll email you when we're next open.",
        invalid: 'Enter a valid email address.',
        failed: 'Something went wrong. Please try again.',
    },

    cart: {
        title: 'Your cart',
        loading: 'Loading your cart…',
        empty: 'Your cart is empty.',
        addMore: 'Add more pizzas',
        unitPrice: '{price} × {qty}',
        decrease: 'Remove one {title}',
        increase: 'Add one {title}',
        remove: 'Remove',
        removeLabel: 'Remove {title} from cart',
        removed: '{title} removed from your cart',
        total: 'Total',
        pay: 'Continue to payment · {total}',
        opening: 'Opening payment…',
        locked: 'Enter your card details below to finish paying, or cancel to change your order.',
        loadingPayment: 'Loading payment form…',
        cancel: 'Cancel payment',
        cancelling: 'Cancelling…',
    },

    note: {
        label: 'Note for the kitchen',
        count: '{count} / {max}',
        saving: 'Saving…',
        saved: 'Saved',
        failed: "Couldn't save your note. Please try again.",
    },

    errors: {
        notOpen: 'The shop is not open right now.',
        soldOut: 'Sorry, we are sold out.',
        checkoutInProgress: 'Payment is in progress for this cart. Continue to payment or cancel it first.',
        overLimit: 'You can order up to {n} pizza. | You can order up to {n} pizza. | You can order up to {n} pizzas.',
        overLimitUnknown: 'That is more pizzas than you can order.',
        itemUnavailable: '"{title}" is no longer available. Remove it to continue.',
        anItemUnavailable: 'An item is no longer available. Remove it to continue.',
        generic: 'Something went wrong. Please try again.',
    },

    cartNotice: {
        reset: 'Your previous service has ended, so your cart was emptied.',
    },

    order: {
        confirmingTitle: 'Confirming your order…',
        confirmingBody: 'This only takes a moment.',
        thanks: 'Thank you for your order!',
        paid: 'Your payment was received.',
        codeLabel: 'Your pickup code',
        codeHint: 'Give this number to our staff when you arrive.',
        receipt: 'A receipt was sent to {email}.',
        summary: 'Your order',
        line: '{qty} × {title}',
        subtotal: 'Subtotal',
        tax: 'Tax',
        total: 'Total',
        slowTitle: 'Still confirming your payment',
        slowBody: "This is taking longer than usual. Keep this page open, or check your email: your receipt and pickup code are sent as soon as payment is confirmed.",
        checkAgain: 'Check again',
        missingTitle: "We couldn't find that order",
        missingBody: 'If you were charged, your receipt email has your pickup code.',
    },

    unsubscribe: {
        working: 'Unsubscribing…',
        doneTitle: "You're unsubscribed",
        doneBody: "You won't receive any more opening alerts from us.",
        failedTitle: "We couldn't unsubscribe you",
        failedBody: 'The link may be invalid or expired. Please try again later.',
        invalidTitle: 'This unsubscribe link is incomplete',
        invalidBody: 'Use the link from the bottom of one of our emails.',
    },

    about: {
        title: 'About Sellout Pizza',
        body: 'We bake a limited number of pizzas for each service. When they are gone, they are gone. Order online and pick up your pie hot from the oven.',
        findUs: 'Find us',
    },

    notFound: {
        title: 'Page not found',
        body: "We couldn't find the page you were looking for.",
    },
}
