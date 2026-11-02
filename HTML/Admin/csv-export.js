(function(root){
  function cell(value, header='') {
    let text;
    if(typeof value==='number') text=Number.isFinite(value)?(/total|paid|refund|balance|amount|price/i.test(header)?value.toFixed(2):String(value)):'';
    else {
      text=String(value??'').replace(/\r\n|\r/g,'\n');
      if(/^\s*[=+@-]/.test(text)||/^[\t\r\n]/.test(text)) text="'"+text;
      else if(/phone|contact/i.test(header)&&/^0\d+$/.test(text)) text="'"+text;
    }
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function serialize(headers,rows){return '\uFEFF'+[headers.map(h=>cell(h)).join(','),...rows.map(row=>headers.map(h=>cell(row[h],h)).join(','))].join('\r\n')+'\r\n';}
  const api={cell,serialize};if(typeof module==='object'&&module.exports)module.exports=api;else root.GMAdminCsv=api;
})(typeof window!=='undefined'?window:globalThis);
