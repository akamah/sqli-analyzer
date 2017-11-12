var fs = require('fs');
var path = require('path');
var engine = require('php-parser');


// traversing AST

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

  if (ast.kind === 'call') {
    inspect_call(ast);
  }

  // switch(ast.kind) {
  //   case 'block':
  //   case 'program': 
  //   case 'namespace':
  //     inspect_body(ast.children);
  //     break;
  //   case 'call':
  //     inspect_call(ast);
  //     break;
  //   case 'if': 
  //     inspect_body(ast.body);
  //     inspect_body(ast.alternate);
  //     break;
  //   case 'do':
  //   case 'while':
  //   case 'for':
  //   case 'foreach':
  //   case 'switch':
  //   case 'case': // body is Block or null
  //   case 'catch':
  //   case 'class':
  //   case 'interface':
  //   case 'trait':
  //   case 'function':
  //   case 'method':
  //     inspect_body(ast.body);
  //     break;
  //   case 'try':
  //     // catches ???
  //   default:
  //     console.log("*** WHATSUP?? ", ast.kind)
  //     break;
  // }
}

// body ::= block | null | array<decl> | stmt | array<node>
function inspect_body(body) {
//  console.log(ast)
  if (ast == null || ast == false) { 
    return;
  } else if (Array.isArray(body)) {
      body.forEach(function(element) {
        inspect(element);
      }, this);
  } else {
    inspect(body);
  }
}

function is_sql_query_function(what) {
  if (what.kind == 'identifier') {
    return what.name == 'mysql_query';
  } else if (what.kind == 'propertylookup' && what.offset.kind == 'constref') {
    return what.offset.name == 'query';
  }

  return false;
}

// htmlentities / htmlspecialchars

function inspect_call(ast) {
  if (is_sql_query_function(ast.what)) {
    inspect_sql_query_string(ast.arguments[0]);
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

function inspect_sql_query_string(ast) {
  var flatten = flatten_string_concatenation(ast);
  console.log(flatten);
}

// initialize a new parser instance
var parser = new engine({
  // some options :
  parser: {
    extractDoc: true
  },
  ast: {
    withPositions: true
  }
});

var buffer = fs.readFileSync('/dev/stdin', 'utf8');

try {
  var ast = parser.parseCode(buffer, "stdin");
  inspect(ast);
} catch (e) {
  console.log(`ERROR: syntax error in '${e.fileName}' at ${e.lineNumber}:${e.columnNumber}`);
  console.log(`ERROR: no analysis done`);

  throw e;
}
