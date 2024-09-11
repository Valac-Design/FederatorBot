# VerseBot
  This bot allows you to federate Discord channels posts similar to an announcement follow, or the experimental Repost feature.

## To install:
  In the file directory, in your terminal, run:
  `npm i`

## To use:
  1.) Add the bot to both host and recipient servers
  2.) /setmanagerole (In Discord - And you can only do this for one of the two servers)
  3.) /sethostchannel (In Discord - This should be the server posts come FROM)
  4.) /setrecipientchannel (In Discord - This should be the server that RECEIVES posts)

## Also, you can blacklist users:
/blacklist add (In Discord - This will filter out that users messages from sending to the recipient)
/blacklist remove (In Discord - This removes users from the blacklist filter)
/blacklist list (Discretely list who's blacklisted)
