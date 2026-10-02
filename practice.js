let arr = [1,2, 3, 4, 5];
arr.push(6);
// console.log(arr);
arr.pop()
// console.log(arr);

let squared = arr.map(item=> item*item);
// console.log(squared);

let filtered = arr.filter(item => item%2 == 0);
// console.log(filtered);

let reduced = arr.reduce((acc, item)=> acc+item, 5);
// console.log(reduced);

arr.unshift(0);
// console.log(arr);

arr.shift();
// console.log(arr);

// arr.forEach(item => console.log(item));

// console.log(arr.slice(1, 2));
// console.log(arr.splice(2, 1, 10));
// console.log(arr);

// console.log(arr.indexOf(1));
// console.log(arr.includes(4));

// let arr2 = arr.concat([6, 7,8,9,10]);
// console.log(arr2);


// console.log(arr.join(','));


// console.log(arr.toString());
// console.log(arr.sort((a, b)=> b-a))
// console.log(arr);

console.log(arr.reverse());