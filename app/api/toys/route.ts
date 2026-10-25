import {getChatGPTUser} from '../../chatgpt-auth';
import {json} from '../../../lib/server-sync';
import {catalogueToys} from '../../../lib/toy-catalogue';
import {readCatalogue,cachedToyDetails} from '../../../lib/server-catalogue';
export async function GET(request:Request){const user=await getChatGPTUser();if(!user)return json({error:'Sign in to view toy details.'},401);const itemId=Number(new URL(request.url).searchParams.get('item'));if(!Number.isInteger(itemId)||!catalogueToys((await readCatalogue())?.index).some(t=>t.itemId===itemId))return json({error:'Choose a toy from the catalogue.'},400);return json(await cachedToyDetails(itemId));}
