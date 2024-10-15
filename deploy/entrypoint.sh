#!/bin/sh
#set -e

printenv | grep NEXT_PUBLIC_ | while  read -r line ; do
   key=$( echo  "$line" | cut -d "=" -f1)
  value=$( echo  "$line" | cut -d "=" -f2)

  for INDEX in $(grep -rli "$key" /app/ ); do
    echo "$INDEX" &&
    sed -i '' -e "s|$key|$value|gI" "$INDEX"
  done
done

node server.js
