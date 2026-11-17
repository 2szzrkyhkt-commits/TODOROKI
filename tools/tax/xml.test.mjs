import assert from 'node:assert/strict';
import {isLawXml} from './xml.mjs';
const enc=new TextEncoder();let cases=0;
function check(xml,wanted){assert.equal(isLawXml(enc.encode(xml)),wanted);cases++;}
check('<Law Era="Showa"><LawBody>条文</LawBody></Law>',true);
for(const length of [9999,10000,26838,53592,100000])check('<law_data_response>'+(' '.repeat(length))+'<Law><LawBody>税法</LawBody></Law></law_data_response>',true);
check('<law_data_response><LawFullText>なし</LawFullText></law_data_response>',false);
check('<LawId>123</LawId>',false);check('<Lawful>text</Lawful>',false);check('<Law>unfinished',false);
check('<Error><Code>2</Code></Error>',false);check('<Law></Law><Error>failure</Error>',false);
check('<Law><Code>1</Code></Law>',true); // Code in real content is not itself an API error.
check('<?xml version="1.0"?>\n<Law\n Era="Showa"></Law>',true);
assert.equal(isLawXml(null),false);cases++;
console.log('T20 XML validation: '+cases+' cases passed; delayed Law after long attachment metadata, exact markers, missing close and API error.');
