# Token Bucket Algorithm Visualisation

This is a small static web page to help visualise the "token bucket algorithm", used by many
services (for example, AWS API Gateway) to implement rate-limiting while allowing for bursts of activity.

It's quite difficult to pick *rate* and *burst* parameters, and I found that visualising how they
interact was helpful.

This was largely written by AI, and it works, but it's not the 
best piece of software engineering in the world by any means...

# Run

This is a Vite app.

```
$ npm install 
$ npm run dev
```

... or just visit it on GitHub Pages

https://ukslim.github.io/token-bucket-visualisation/
