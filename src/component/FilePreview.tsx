import React, {useEffect, useState} from "react";
import {FileContent, GetFile, GetFileContent} from "../api/file";
import {Transaction} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {historyField} from "@codemirror/commands";
import {FileI} from "./FileEditor";


export default function FilePreview(props: {file?:FileI}) {
    const [content, setContent] = useState<FileContent>()

    // 当 body 改变重新更改
    useEffect(() => {
        (async function () {
            const nf = await GetFileContent({project_id: 0, path: props.file?.path!, bucket: 'project'})
            setContent(nf.data)
        })()

    }, [props.file?.path])

    return <div className="p-4 space-y-4" >
        <div>{JSON.stringify(content?.meta)}</div>
        <div className="prose " dangerouslySetInnerHTML={{__html: content?.content || ''}}></div>
    </div>
}