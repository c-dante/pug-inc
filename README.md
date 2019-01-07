# pug-inc
Implementation to translate pug to [hyperscript](https://github.com/hyperhype/hyperscript) calls.

Written to expect the hyperscript API: `h(tag, attrs, [text?, Elements?,...]) -> VDOM` -- can be any method you want.

Intended as an bridge from the nice [pug](https://pugjs.org/api/getting-started.html) syntax for templates, with some opinions on what should-and-shouldn't be allowed for full on inline JS.


## Why
I'm NOT a fan of giving devs full-on-js freedom in their templates. Why? Because messes happen. Mistakes happen.

Pug is a really nice, succinct langauge to build nested DOM elements.

Mostly a thought project. Maybe it will take shape. Maybe it won't. Who knows?

