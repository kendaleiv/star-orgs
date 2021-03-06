export default class Directory {
  getUsers(directoryUrl, filterFunction) {
    return fetch(directoryUrl)
      .then(res => res.json())
      .then(users => {
        if (filterFunction) {
          return users.filter(x => filterFunction(x));
        }

        return users;
      });
  }
}
