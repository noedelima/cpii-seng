"""Run isolated regressions. No production credentials are inherited by emulators."""
import os,pathlib,shutil,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]
subprocess.run([sys.executable,'tests/security/prepare-sdk.py'],cwd=root,check=True)
env=os.environ.copy()
for key in list(env):
 if any(x in key.upper() for x in ['TOKEN','PASSWORD','SECRET','CREDENTIAL','FB_SA','LDAP','FIREBASE_TEST','PROXY']):env.pop(key,None)
env.update(CI='true',GCLOUD_PROJECT='demo-security-cpii-seng',GOOGLE_CLOUD_PROJECT='demo-security-cpii-seng',JAVA_TOOL_OPTIONS='-Xmx768m -XX:ActiveProcessorCount=2')
env['XDG_CONFIG_HOME']=str(root/'.test-cache/config')
cli=os.environ.get('TEST_FIREBASE_CLI') or str(root/'node_modules/.bin/firebase')
if not pathlib.Path(cli).exists():raise SystemExit('Run npm ci first, or provide TEST_FIREBASE_CLI.')
command=[cli,'emulators:exec','--project','demo-security-cpii-seng','--config','firebase.security.json','--only','auth,firestore,storage','python3 tests/security/rules.py && node tests/security/api-rules.cjs && SECURITY_EMULATORS=1 node tests/security/browser.cjs']
sys.exit(subprocess.call(command,cwd=root,env=env))
