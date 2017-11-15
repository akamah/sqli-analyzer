var fs = require('fs');
var path = require('path');
var engine = require('php-parser');


//////////// traversing AST
function inspect(ast) {
//  console.log(ast.kind);

  if (ast == null) {
    return;
  }
  
  // 
  if (ast.hasOwnProperty('children')) {
    inspect_body(ast.children);
  }
  if (ast.hasOwnProperty('body')) {
    inspect_body(ast.body);
  }
  if (ast.hasOwnProperty('alternate')) {
    inspect_body(ast.alternate);
  }
  if (ast.hasOwnProperty('right')) {
    inspect(ast.right);
  }
  
  if (ast.kind === 'call') {
    inspect_call(ast);
  }
}

// body ::= block | null | array<decl> | stmt | array<node>
function inspect_body(body) {
  //  console.log(ast)
  if (body == null || body == false) { 
    return;
  } else if (Array.isArray(body)) {
    body.forEach(function(element) {
      inspect(element);
    }, this);
  } else {
    inspect(body);
  }
}

//////////// utility function to inspect AST
function is_global_function_call(what) {
  return what.kind === 'identifier';
}

function is_mysqli_staticlookup(what) {
  return what.kind === 'staticlookup' && 
  what.what.kind === 'identifier' &&
  what.what.name === 'mysqli' &&
  what.offset.kind === 'constref';
}

function is_PDO_propertylookup(what) {
  return what.kind === 'propertylookup' && 
  what.offset.kind === 'constref';
}


function is_sql_query_function(what) {
  if (is_global_function_call(what)) {
    return ['mysql_query', 'mysqli_query'].includes(what.name);
  } else if (is_PDO_propertylookup(what)) {
    return what.offset.name === 'query';
  } else if (is_mysqli_staticlookup(what)) {
    return what.offset.name === 'query';
  }
  
  return false;
}

function is_sql_escape_function(what) {
  if (is_global_function_call(what)) {
    return ['mysql_escape_string', 'mysql_real_escape_string', 'mysqli_escape_string', 'mysqli_real_escape_string'].includes(what.name);
  } else if (is_PDO_propertylookup(what)) {
    return what.offset.name === 'quote';
  } else if (is_mysqli_staticlookup(what)) {
    return what.offset.name === 'real_escape_string';
  }
  
  return false;
}


function is_encoding_function(what) {
  if (is_global_function_call(what)) {
    return ['mysql_set_charset', 'mysqli_set_charset'].includes(what.name);
  } else if (is_mysqli_staticlookup(what)) {
    return what.offset.name === 'set_charset';
  }
  
  return false;
}

var encoding_have_set = false;

function inspect_encoding_function() {
  encoding_have_set = true;
}

/////// inspect inside function call
function inspect_call(ast) {  
  if (is_sql_query_function(ast.what)) {
    inspect_sql_query_string(ast.arguments[0]);
    return;
  }

  if (is_encoding_function(ast.what)) {
    inspect_encoding_function();
    return;
  }
}

/** flatten linked list of boolean operator `.'
* @param ast: AST of the first argument of sql-query functions
* @returns: array of each element
*/
function flatten_string_concatenation(ast) {
  if (ast.kind === 'bin' && ast.type === '.') {
    var rest = flatten_string_concatenation(ast.left);
    return rest.concat(flatten_string_concatenation(ast.right));
  } else if (ast.kind === 'encapsed') {
    // unfold encapsed string, like "hello, {$name}!"
    return ast.value.reduce(function(prev, current, index, arr) {
      return prev.concat(flatten_string_concatenation(current));
    }, []);
  } else if (ast.kind === 'parenthesis') {
    // (hoge) => hoge
    return flatten_string_concatenation(ast.inner);
  } else {
    return [ast];
  }
}

var karma = 0;
var alert_output = "";

function alert_vulnerability(ast, msg) {
  alert_output += `WARNING at line ${ast.loc.start.line}: ` + msg + "\n";
  karma += 1;
}

function report_total_result() {
  if (karma === 0) {
    alert_output += "RESULT: OK";
  } else {
    alert_output += `RESULT: ${karma} warnings`;
  }
  
  console.log(alert_output);  
  alert_output = "";
}

// check surrounding strings are good for escaping
// only simple checks are done in this step
function inspect_escaping_strings(left, right) {  
  if (left === undefined) {
    alert_vulnerability(left, "bad variable position");    
  }
  if (right === undefined) {
    alert_vulnerability(right, "bad variable position");    
  }
  if (left.kind !== 'string') {
    alert_vulnerability(left, "expression before variable is not string");    
  }
  if (right.kind !== 'string') {
    alert_vulnerability(right, "expression before variable is not string");    
  }
  
  var l = left.value;
  var r = right.value;
  
  if (l[l.length - 1] === "'" && l[l.length - 2] === "'") {
    alert_vulnerability(left, "variable is doubly single quoted");    
  }
  if (l[l.length - 1] === '"' && l[l.length - 2] === '"') {
    alert_vulnerability(left, "variable is doubly double quoted");    
  }

  if ((l[l.length - 1] === "'" && r[0] === "'") ||
  (l[l.length - 1] === "'" && r[0] === "'")) {
    return;
  } else {
    alert_vulnerability(left, "variable is not properly escaped by enclosing strings");
  }
}

// inspect the first argument of sql_query function
function inspect_sql_query_string(ast) {
  if (!encoding_have_set) {
    alert_vulnerability(ast, "encoding is not set before sql query");
  }

  var flatten = flatten_string_concatenation(ast);
  
  flatten.forEach(function(value, index, array) {
    if (value.kind === 'string') {
      // ok
    } else if (value.kind === 'call' && is_sql_escape_function(value.what)) {
      var left = array[index - 1]; // get surrounding string 
      var right = array[index + 1];
      
      inspect_escaping_strings(left, right);
    } else {
      alert_vulnerability(value, 'value is not escaped');
    }
  }, this);
  
}

function main(buffer) {
  // initialize a new PHP parser
  var parser = new engine({
    // some options :
    parser: {
      extractDoc: true
    },
    ast: {
      withPositions: true
    }
  });
    
  try {
    var ast = parser.parseCode(buffer, "stdin");
    inspect(ast);
  } catch (e) {
    console.log(`ERROR: syntax error in '${e.fileName}' at ${e.lineNumber}:${e.columnNumber}`);
    console.log(`ERROR: no analysis done`);
    
    throw e;
  } finally  {
    report_total_result();
  }
}

// read strings from stdin then inspect
if (typeof document === 'undefined') {
  main(fs.readFileSync('/dev/stdin', 'utf8'));
}

