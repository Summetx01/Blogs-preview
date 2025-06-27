export function parseArticleHeadings(content) {
  if (typeof content !== "string") {
    const filteredItems = content?.filter((item) => item.style === "h2");
    const texts = filteredItems
      ?.map((item) => item.children)
      .flat()
      ?.map((item) => item.text.replace(/\n/g, ""));
    const headingsParsed = texts?.map((item) => ({
      id: item.toLowerCase().split(" ").join("-"),
      title: item,
    }));
    return headingsParsed;
  } else {
    const headingElementRegex = /<h[1-2][^>]*?>(?<TagText>.*?)<\/h[1-2]>/g;
    const headingElements = content.match(headingElementRegex);
    const headingParseRegex = /<([^\s]+).*?id="([^"]*?)".*?>(.+?)<\/\1>/;
    let headingsParsed = [];
    headingElements?.forEach((item) => {
      const parsedHeading = item.match(headingParseRegex);
      if (parsedHeading && parsedHeading.length > 2)
        headingsParsed.push({ id: parsedHeading[2], title: parsedHeading[3] });
    });
    return headingsParsed;
  }
}

function getMonthString(date) {
  switch (date.getMonth()) {
    case 0:
      return "January";
    case 1:
      return "February";
    case 2:
      return "March";
    case 3:
      return "April";
    case 4:
      return "May";
    case 5:
      return "June";
    case 6:
      return "July";
    case 7:
      return "August";
    case 8:
      return "September";
    case 9:
      return "October";
    case 10:
      return "November";
    case 11:
      return "December";
  }
}

export function getDateFormattedString(date) {
  return `${getMonthString(date)} ${date.getFullYear()}`;
}

export const getDocHeight = (offsetHeight) => {
  return (
    Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    ) - offsetHeight
  );
};

export function truncateStringToWords(str, numWords) {
  const words = str.split(" ");
  if (words.length <= numWords) {
    return str;
  }
  return words.slice(0, numWords).join(" ") + "...";
}
