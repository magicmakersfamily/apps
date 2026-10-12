# Setting up the progress log (for parents)

The page works with no setup. Setting up one device (James's iPad) makes it send which characters
James wrote or tapped to a private Google Sheet that you own. Nothing is sent from any other device.

1. Make a Google Sheet called **James writing log**.
2. Extensions > Apps Script. Paste in the `Code.gs` you were given (it holds a secret token, so it is not in this repository). Run `setup` once and allow access.
3. Deploy > New deployment > Web app. Execute as **Me**, who has access **Anyone**. Copy the URL that ends in `/exec`.
4. On the iPad, open `https://magicmakersfamily.github.io/games/renzi/?setup=<URL>&token=<TOKEN>&who=ipad` (URL and token from steps 2 and 3). The page says "This device is set up". Then Share > Add to Home Screen.
5. To stop sending: open the page with `?setup=off`, or use "Hold to stop sending" in the grown-ups panel (the (i) button).

Events are appended to the **Events** tab (time, device, day, kind, char, value, mistakes, mode, eid). The **Summary** tab counts them. To rotate the token, change `TOKEN` in the script, redeploy, and run the setup link again.
