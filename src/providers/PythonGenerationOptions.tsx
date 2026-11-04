import type {GenerationOptionsProps} from '../executionTypes'
export function PythonGenerationOptions({catalog,value,onChange,disabled}:GenerationOptionsProps){
  const directories=catalog.options.test_directories as string[]||[]
  return <label>Generated test directory<select disabled={disabled} value={String(value.test_directory||catalog.options.default_test_directory||'.')} onChange={e=>onChange({test_directory:e.target.value})}>{directories.map(path=><option key={path}>{path}</option>)}</select></label>
}
