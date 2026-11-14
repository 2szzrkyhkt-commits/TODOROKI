from pathlib import Path
import json,copy
from jsonschema import Draft202012Validator,FormatChecker
root=Path(__file__).parent
source={'type':'object','additionalProperties':False,'required':['url','checked_at'],'properties':{'url':{'type':'string','format':'uri','pattern':'^https://'},'checked_at':{'type':'string','format':'date-time'},'published_at':{'type':['string','null'],'format':'date-time'},'document_id':{'type':['string','null']}}}
metric={'type':'object','additionalProperties':False,'required':['id','period','value','unit','scale','status','sources'],'properties':{'id':{'type':'string','minLength':1},'period':{'type':'string','minLength':1},'value':{'type':['number','null']},'unit':{'enum':['JPY','USD','ratio','percent','count','index']},'scale':{'enum':[1,1000,1000000,1000000000]},'status':{'enum':['verified','calculated','missing','pending','incompatible','stale']},'sources':{'type':'array','items':{'$ref':'#/$defs/source'}},'formula_version':{'type':'string','minLength':1},'inputs':{'type':'array','minItems':1,'items':{'type':'string'}},'scope':{'type':['string','null']},'standard':{'type':['string','null']}},'allOf':[{'if':{'properties':{'status':{'enum':['verified','calculated']}}},'then':{'properties':{'value':{'type':'number'},'sources':{'minItems':1}}}},{'if':{'properties':{'status':{'const':'missing'}}},'then':{'properties':{'value':{'type':'null'}}}},{'if':{'properties':{'status':{'const':'calculated'}}},'then':{'required':['formula_version','inputs']}}]}
schema={
 '$schema':'https://json-schema.org/draft/2020-12/schema',
 'title':'TODOROKI common numeric response v1',
 'type':'object','additionalProperties':False,
 'required':['schema_version','project','access','generated_at','partial','items','next_cursor','errors'],
 'properties':{
  'schema_version':{'const':'1.0'},
  'project':{'enum':['equity-jp','equity-us','statistics-jp','statistics-us','support','slot','learning','content']},
  'access':{'enum':['public','owner','access-protected']},
  'generated_at':{'type':'string','format':'date-time'},
  'partial':{'type':'boolean'},
  'items':{'type':'array','maxItems':100,'items':{'$ref':'#/$defs/metric'}},
  'next_cursor':{'type':['string','null']},
  'errors':{'type':'array','items':{'type':'object','additionalProperties':False,
   'required':['project','code','retry_at'],
   'properties':{'project':{'type':'string'},'code':{'type':'string'},'retry_at':{'type':['string','null'],'format':'date-time'}}}}
 },
 '$defs':{'source':source,'metric':metric}
}
metric['allOf'].append({'if':{'properties':{'unit':{'enum':['ratio','percent','count','index']}}},'then':{'properties':{'scale':{'const':1}}}})
Draft202012Validator.check_schema(schema)
v=Draft202012Validator(schema,format_checker=FormatChecker())
record={'id':'operating_cf','period':'2026-03-31','value':0,'unit':'JPY','scale':1000000,'status':'verified','sources':[{'url':'https://example.com/official-disclosure','checked_at':'2026-11-14T00:00:00Z'}]}
base={'schema_version':'1.0','project':'equity-jp','access':'owner','generated_at':'2026-11-14T00:00:00Z','partial':False,'items':[record],'next_cursor':None,'errors':[]}
v.validate(base)
missing=copy.deepcopy(base);missing['items'][0].update(value=None,status='missing',sources=[]);v.validate(missing)
invalid=[]
for patch in [{'status':'missing','value':0},{'status':'verified','sources':[]},{'status':'calculated'},{'unit':'JPY_USD'},{'unit':'percent','scale':1000},{'status':'unknown'},{'value':None}]:
 d=copy.deepcopy(base);d['items'][0].update(patch);assert list(v.iter_errors(d)),patch;invalid.append(patch)
calc=copy.deepcopy(base);calc['items'][0].update(status='calculated',formula_version='owner-earnings-v1',inputs=['profit','depreciation','ppe_purchase']);v.validate(calc)
(root/'common-data-api.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n')
print('PASS Draft 2020-12 schema; genuine zero; missing null; calculated provenance; seven invalid data cases rejected')
